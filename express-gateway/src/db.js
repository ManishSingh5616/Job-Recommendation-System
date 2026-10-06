import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = path.dirname(fileURLToPath(import.meta.url));

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const query = (text, params) => pool.query(text, params);

export async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function initSchema() {
  await pool.query(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));
}

/** Find a row by case-insensitive name, creating it if needed (race-safe). */
async function getOrCreate(client, table, column, value, extraCols = [], extraVals = []) {
  const found = await client.query(`SELECT id FROM ${table} WHERE LOWER(${column}) = LOWER($1)`, [value]);
  if (found.rows[0]) return found.rows[0].id;
  const cols = [column, ...extraCols];
  const vals = [value, ...extraVals];
  const ph = vals.map((_, i) => `$${i + 1}`).join(', ');
  const ins = await client.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${ph}) ON CONFLICT DO NOTHING RETURNING id`, vals);
  if (ins.rows[0]) return ins.rows[0].id;
  const again = await client.query(`SELECT id FROM ${table} WHERE LOWER(${column}) = LOWER($1)`, [value]);
  return again.rows[0].id;
}

export const getOrCreateSkill = (client, name) => getOrCreate(client, 'skills', 'skill_name', name, ['category'], ['Technical']);
export const getOrCreateCompany = (client, name, industry) => getOrCreate(client, 'companies', 'name', name, ['industry'], [industry || null]);
