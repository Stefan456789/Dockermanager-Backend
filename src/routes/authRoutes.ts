import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as db from '../models/database';
import { authenticateJWT, requirePermission } from '../middleware/authMiddleware';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify Google token and authenticate user
router.post('/google-signin', async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Find or create user
    let user = await db.findUserByEmail(payload.email);
    if (!user) {
      user = await db.createUser({
        id: payload.sub || '',
        email: payload.email,
        name: payload.name,
        picture: payload.picture
      });
    }
    
    // Generate JWT token
    const jwtToken = jwt.sign(
      { 
        id: user.id, 
        email: user.email 
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    // Return user info and token
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      token: jwtToken
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
});

// Check if a token is valid
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ valid: false, message: 'No token provided' });
    }
    
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
    const user = await db.findUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    return res.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

// Get current user's permissions (requires auth)
router.get('/permissions', authenticateJWT, (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const permissions = db.getUserPermissions(req.user.id, req.user);
    return res.json({ permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return res.status(500).json({ message: 'Error fetching permissions' });
  }
});

export const authRoutes = router;
