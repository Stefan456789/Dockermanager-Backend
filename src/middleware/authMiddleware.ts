import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as db from '../models/database';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Extend Request type to include user property
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
      };
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    
    // Find the user in the database
    const user = await db.findUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    // Add user info to the request object
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Middleware to check for specific permission
export function requirePermission(...permission: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    console.log(`Checking permissions for user ${req.user.email} (${req.user.id})`);
    const userPermissions = await db.getUserPermissions(req.user.id);
    console.log(`User has ${userPermissions.length} permissions:`, userPermissions.map(p => p.name));
    
    if (!userPermissions || !Array.isArray(userPermissions)) {
      return res.status(403).json({ message: 'Access denied: No permissions found' });
    }

    const hasRequiredPermissions = permission.every((perm) => userPermissions.map(p => p.name).includes(perm));
    console.log(`Has required permissions ${permission}: ${hasRequiredPermissions}`);
    
    if (!hasRequiredPermissions) {
      return res.status(403).json({ 
        message: `Access denied: Missing required permissions: ${permission.join(', ')}` 
      });
    }
    
    next(); // This was missing - call next() to continue to the route handler
  };
}

// Middleware to check for specific container permission
export function requireContainerPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const containerId = req.params.id;
    if (!containerId) {
      return res.status(400).json({ message: 'Container ID required' });
    }
    
    const hasPermission = db.hasContainerPermission(req.user.id, containerId, permission);
    
    if (!hasPermission) {
      return res.status(403).json({ message: `Access denied: Missing permission '${permission}' on container ${containerId}` });
    }
    
    next();
  };
}