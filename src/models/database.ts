import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
}

class SQLiteDB {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isSQLiteAvailable: boolean = true;

  constructor() {
    this.dbPath = path.join(__dirname, './data/database.sqlite');
    
    // Ensure the data directory exists
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    console.log('Initializing SQLite database at:', this.dbPath);
    try {
      this.db = new Database(this.dbPath);
      this.initDb();
    } catch (error) {
      this.isSQLiteAvailable = false;
    }
  }

  private initDb() {
    if (!this.db) return;
    
    // Create users table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT,
        picture TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  findUserByEmail(email: string): User | undefined {
    if (!this.db || !this.isSQLiteAvailable) {
      console.warn('SQLite database is not available. Using memory mode or returning mock data.');
      // For development, you might want to return a mock user
      return {
        id: 'mock-id',
        email: email,
        name: 'Mock User',
        picture: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
        created_at: new Date().toISOString()
      };
    }
    
    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
      const user = stmt.get(email) as User | undefined;
      return user;
    } catch (error) {
      console.error('Error while querying database:', error);
      this.isSQLiteAvailable = false;
      // Return mock user if database query fails
      return {
        id: 'mock-id',
        email: email,
        name: 'Mock User',
        picture: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y",
        created_at: new Date().toISOString()
      };
    }
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
    
    if (!this.db || !this.isSQLiteAvailable) {
      console.warn('SQLite database is not available. Returning user without saving to database.');
      return newUser;
    }
    
    const stmt = this.db.prepare(`
      INSERT INTO users (id, email, name, picture, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
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

// Database singleton
let db: SQLiteDB | null = null;

export function getDb() {
  if (db) return db;
  
  db = new SQLiteDB();
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
