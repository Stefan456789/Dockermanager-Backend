import fs from 'fs';
import path from 'path';

// Simple in-memory database for development
// This avoids the native binding issues with better-sqlite3
interface User {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  created_at: string;
}

class InMemoryDB {
  private users: User[] = [];

  constructor() {
    console.log('Initializing in-memory database');
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

// Database singleton
let db: InMemoryDB | null = null;

export function getDb() {
  if (db) return db;
  
  db = new InMemoryDB();
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
