import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import * as db from '../models/database';

const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
    
    // Return user info and token
    return res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      token // Return the same token for client-side storage
    });
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Authentication failed' });
  }
});

export const authRoutes = router;
