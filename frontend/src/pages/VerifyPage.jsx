// frontend/src/pages/VerifyPage.jsx
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api.js';
import { Spinner } from '../components/ui.jsx';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('Verifying your email...');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Missing verification token.');
      setStatus('');
      return;
    }

    // Call backend verify endpoint
    fetch('http://localhost:5000/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Verification failed.');
        
        // Save session token and redirect home
        setToken(data.token);
        setStatus('Email verified successfully! Redirecting...');
        setTimeout(() => navigate('/'), 1500);
      })
      .catch((err) => {
        setError(err.message);
        setStatus('');
      });
  }, [token, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6 text-white">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 text-ink shadow-xl text-center">
        <h2 className="text-xl font-extrabold tracking-tight">Email Verification</h2>
        
        {status && <p className="mt-4 text-sm text-teal-700 flex items-center justify-center gap-2"><Spinner /> {status}</p>}
        {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}

        {error && (
          <button 
            onClick={() => navigate('/auth')} 
            className="mt-6 btn btn-primary w-full"
          >
            Back to Sign In
          </button>
        )}
      </div>
    </div>
  );
}