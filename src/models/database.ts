import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Database interfaces
interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
}

class SqliteDB {
  private db: Database.Database;
  
  constructor(dbPath: string) {
    try {
      // Ensure directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      this.db = new Database(dbPath);
      console.log('Initializing SQLite database');
      this.initializeTables();
    } catch (error) {
      console.error('Failed to initialize SQLite database:', error);
      throw error;
    }
  }

  private initializeTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        picture TEXT,
        created_at TEXT NOT NULL
      )
    `);
  }

  findUserByEmail(email: string): User | undefined {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    return stmt.get(email) as User | undefined;
  }

  createUser(user: { id: string, email: string, name?: string, picture?: string }): User {
    const existingUser = this.findUserByEmail(user.email);
    if (existingUser) return existingUser;

    const newUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      created_at: new Date().toISOString()
    };
    
    const stmt = this.db.prepare(
      'INSERT INTO users (id, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    
    stmt.run(
      newUser.id,
      newUser.email,
      newUser.name || null,
      newUser.picture || null,
      newUser.created_at
    );
    
    return newUser;
  }
}

// Fallback in-memory database if SQLite fails
class InMemoryDB {
  private users: User[] = [];

  constructor() {
    console.log('Initializing in-memory database (fallback)');
  }

  findUserByEmail(email: string): User | undefined {
    return this.users.find(user => user.email === email);
  }

  createUser(user: { id: string, email: string, name?: string, picture?: string }): User {
    const existingUser = this.findUserByEmail(user.email);
    if (existingUser) return existingUser;

    const newUser: User = {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      created_at: new Date().toISOString()
    };
    
    this.users.push(newUser);
    return newUser;
  }
}

// Database type
type DatabaseImplementation = SqliteDB | InMemoryDB;

// Database singleton
let db: DatabaseImplementation | null = null;

export function getDb() {
  if (db) return db;
  
  try {
    // Define a path for the SQLite database file
    const dbPath = path.join(process.cwd(), 'data', 'dockermanager.db');
    db = new SqliteDB(dbPath);
  } catch (error) {
    console.warn('SQLite initialization failed, falling back to in-memory database:', error);
    db = new InMemoryDB();
  }
  
  return db;
}

export function findUserByEmail(email: string) {
  const db = getDb();
  return db.findUserByEmail(email);
}

export function createUser(user: { id: string, email: string, name?: string, picture?: string }) {
  const db = getDb();
  return db.createUser(user);
}
