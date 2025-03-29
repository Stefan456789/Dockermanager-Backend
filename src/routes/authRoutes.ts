import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as db from '../models/database';
import { authenticate, requirePermission } from '../middleware/authMiddleware';

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
router.get('/permissions', authenticate ,(req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    const permissions = db.getUserPermissions(req.user.id);
    return res.json({ permissions });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return res.status(500).json({ message: 'Error fetching permissions' });
  }
});

// Get all available permissions
router.get('/all-permissions', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const permissions = await db.getPermissions();
    res.json({ permissions });
  } catch (error) {
    console.error('Error fetching all permissions:', error);
    res.status(500).json({ message: 'Error fetching permissions' });
  }
});

// Get all users (requires admin permission)
router.get('/users', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const users = await db.getUsers();
    const usersWithPermissions = await Promise.all(
      users.map(async (user) => ({
        ...user,
        permissions: await db.getUserPermissions(user.id)
      }))
    );
    console.log('Fetched users with permissions:', JSON.stringify(usersWithPermissions, null, 2));
    res.json({ users: usersWithPermissions });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Delete user (requires admin permission)
router.delete('/users/:userId', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    await db.deleteUser(req.params.userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Update user permissions (requires admin permission)
router.post('/users/:userId/permissions', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { permissions } = req.body;

    // Remove all existing permissions
    await db.removeAllUserPermissions(userId);

    // Add new permissions
    for (const permissionId of permissions) {
      await db.addUserPermission(userId, permissionId);
    }

    res.json({ message: 'Permissions updated successfully' });
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ message: 'Error updating permissions' });
  }
});

export const authRoutes = router;
