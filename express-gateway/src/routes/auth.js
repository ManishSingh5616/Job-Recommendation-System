import bcrypt from 'bcryptjs';
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { sendVerificationEmail } from '../services/emailService.js';

const router = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// 1. Register: Validates input, hashes password, and sends verification email (NO DB write yet)
router.post('/register', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (name.length < 2) return res.status(400).json({ error: 'Enter your full name.' });
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8) return res.status(400).json({ error: 'Use a password with at least 8 characters.' });

    // Check if user already exists in the real database
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });
    }

    const hash = await bcrypt.hash(password, 10);

    // Create a temporary secure registration token valid for 15 minutes
    const verificationToken = jwt.sign(
      { name, email, password_hash: hash },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Send the email. Database remains untouched, protecting against spam/bot bloat.
    await sendVerificationEmail(email, verificationToken);

    res.status(200).json({ 
      message: 'Verification email sent. Please check your inbox to complete your registration.' 
    });
  } catch (err) { next(err); }
});

// 2. Verify: Triggered when user clicks the email link. NOW the user is saved to the DB.
router.post('/verify', async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Missing verification token.' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'Verification link is invalid or has expired.' });
    }

    const { name, email, password_hash } = decoded;

    // Double-check race conditions / existing accounts
    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Account already exists. Please sign in.' });
    }

    // Insert user into database permanently
    const { rows } = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, password_hash]
    );

    if (!rows[0]) return res.status(500).json({ error: 'Failed to create account.' });

    // Automatically log them in by returning a session token
    res.status(201).json({ 
      message: 'Email verified successfully!',
      token: signToken(rows[0]), 
      user: publicUser(rows[0]) 
    });
  } catch (err) { next(err); }
});

// 3. Login: Standard sign-in for verified users stored in DB
router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = rows[0];
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }
    
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

// 4. Me: Profile fetch route
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, email FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]) return res.status(401).json({ error: 'Account not found.' });
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

export default router;