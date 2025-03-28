import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import * as db from '../models/database';

// JWT token secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: db.UserContext;
    }
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid or expired token' });
      }
      
      // Set user context in request for later use
      req.user = decoded as db.UserContext;
      next();
    });
  } else {
    res.status(401).json({ message: 'Authorization header required' });
  }
}

// Middleware to check for specific permission
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    try {
      // Check if user has the required permission
      if (db.hasPermission(req.user.id, permission, req.user)) {
        next();
      } else {
        res.status(403).json({ 
          message: `Access denied: Permission ${permission} required` 
        });
      }
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
}
