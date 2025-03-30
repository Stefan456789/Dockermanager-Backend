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

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface UserPermission {
  user_id: string;
  permission_id: number;
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
      
      this.db = new Database(dbPath, { verbose: console.log });
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
      );

      CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL,
        permission_id INTEGER NOT NULL,
        PRIMARY KEY (user_id, permission_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      );
    `);
    
    // Seed default permissions if the permissions table is empty
    this.seedDefaultPermissions();
  }

  // Seed default permissions
  private seedDefaultPermissions() {
    // Check if permissions table is empty
    const count = this.db.prepare('SELECT COUNT(*) as count FROM permissions').get() as { count: number };
    
    if (count.count === 0) {
      console.log('Seeding default permissions');
      
      const defaultPermissions = [
        { name: 'container.view', description: 'View container information' },
        { name: 'container.start', description: 'Start containers' },
        { name: 'container.stop', description: 'Stop containers' },
        { name: 'container.read_console', description: 'Read container console output' },
        { name: 'container.write_console', description: 'Write to container console' },
        { name: 'user.change_permissions', description: 'Change User Permissions' }
      ];
      
      const insertStmt = this.db.prepare('INSERT INTO permissions (name, description) VALUES (?, ?)');
      
      // Use transaction for better performance
      const transaction = this.db.transaction(() => {
        for (const perm of defaultPermissions) {
          insertStmt.run(perm.name, perm.description);
        }
      });
      
      transaction();
      console.log('Default permissions seeded successfully');
    }
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

  getUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users');
    return stmt.all() as User[];
  }

  deleteUser(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    stmt.run(userId);
  }

  removeAllUserPermissions(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM user_permissions WHERE user_id = ?');
    stmt.run(userId);
  }

  // Permission management methods
  getPermissions(): Permission[] {
    const stmt = this.db.prepare('SELECT * FROM permissions');
    return stmt.all() as Permission[];
  }

  getPermission(id: number): Permission | undefined {
    const stmt = this.db.prepare('SELECT * FROM permissions WHERE id = ?');
    return stmt.get(id) as Permission | undefined;
  }

  getPermissionByName(name: string): Permission | undefined {
    const stmt = this.db.prepare('SELECT * FROM permissions WHERE name = ?');
    return stmt.get(name) as Permission | undefined;
  }

  createPermission(name: string, description: string): Permission {
    const existingPermission = this.getPermissionByName(name);
    if (existingPermission) return existingPermission;

    const stmt = this.db.prepare(
      'INSERT INTO permissions (name, description) VALUES (?, ?)'
    );
    
    const result = stmt.run(name, description);
    
    return {
      id: result.lastInsertRowid as number,
      name,
      description
    };
  }

  // User permissions methods
  getUserPermissions(userId: string): Permission[] {
    const user = this.findUserByEmail(process.env.ADMIN_EMAIL ?? 'Error');
    if (user?.id === userId) {
      return this.getPermissions();
    }
    const stmt = this.db.prepare(`
      SELECT p.* FROM permissions p
      JOIN user_permissions up ON p.id = up.permission_id
      WHERE up.user_id = ?
    `);
    return stmt.all(userId) as Permission[];
  }

  addUserPermission(userId: string, permissionId: number): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO user_permissions (user_id, permission_id) VALUES (?, ?)'
    );
    stmt.run(userId, permissionId);
  }

  removeUserPermission(userId: string, permissionId: number): void {
    const stmt = this.db.prepare(
      'DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?'
    );
    stmt.run(userId, permissionId);
  }

  hasPermission(userId: string, permissionName: string): boolean {
    const user = this.findUserByEmail(process.env.ADMIN_EMAIL ?? 'Error');
    if (user?.id == userId){
      return true;
    }
    const stmt = this.db.prepare(`
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = ? AND p.name = ?
    `);
    return !!stmt.get(userId, permissionName);
  }
}

// Database singleton
let db: SqliteDB | null = null;

export function getDb() {
  if (db) return db;
  
  // Define a path for the SQLite database file
  const dbPath = path.join(process.cwd(), 'data', 'dockermanager.db');
  db = new SqliteDB(dbPath);
  
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

// Export permission functions
export function getPermissions() {
  const db = getDb();
  return db.getPermissions();
}

export function createPermission(name: string, description: string) {
  const db = getDb();
  return db.createPermission(name, description);
}

export function getUserPermissions(userId: string) {
  const db = getDb();
  return db.getUserPermissions(userId);
}

export function addUserPermission(userId: string, permissionId: number) {
  const db = getDb();
  return db.addUserPermission(userId, permissionId);
}

export function removeUserPermission(userId: string, permissionId: number) {
  const db = getDb();
  return db.removeUserPermission(userId, permissionId);
}

export function hasPermission(userId: string, permissionName: string) {
  const db = getDb();
  return db.hasPermission(userId, permissionName);
}

export function deleteUser(userId: string) {
  const db = getDb();
  db.deleteUser(userId);
}

export function removeAllUserPermissions(userId: string) {
  const db = getDb();
  db.removeAllUserPermissions(userId);
}

export function getUsers() {
  const db = getDb();
  return db.getUsers();
}