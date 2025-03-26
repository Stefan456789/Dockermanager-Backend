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

// Placeholder for future container-specific authorization
export const authorizeContainer = (req: Request, res: Response, next: NextFunction) => {
  const containerId = req.params.id;
  
  // For now, just pass through if authenticated
  // Later, we can check if the user has permission for this specific container
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // TODO: Check if the user has permissions for this container
  // const hasPermission = checkContainerPermission(req.user.id, containerId);
  
  // For now, allow all authenticated users
  next();
};
