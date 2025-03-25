import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

// Database connection singleton
let db: any = null;

export function getDb() {
  if (db) return db;
  
  db = new Database('./users.db', { verbose: console.log });
  
  initDb(db);
  return db;
}

function initDb(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function findUserByEmail(email: string) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

export function createUser(user: { id: string, email: string, name?: string, picture?: string }) {
  const db = getDb();
  db.prepare(
    'INSERT OR IGNORE INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)'
  ).run(user.id, user.email, user.name || null, user.picture || null);
  
  return findUserByEmail(user.email);
}
