import express from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import * as db from '../models/database';
import { authenticate, requirePermission } from '../middleware/authMiddleware';
import dockerService from '../services/dockerService';

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
      console.log("Unknown user tried login")
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    console.log(`User login attempt: ${payload.email} (admin: ${process.env.ADMIN_EMAIL})`);
    
    // Find or create user
    let user = await db.findUserByEmail(payload.email);
    if (!user) {
      console.log(`Creating user ${payload.name} (${payload.email})`)
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

    console.log(`User ${payload.name} (${payload.email}) logged in successfully`)
    
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
      console.log(`User ${decoded.email} not found`)
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    console.log(`User ${decoded.email} verified`)
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
    
    // Filter out admin user
    const adminEmail = process.env.ADMIN_EMAIL;
    const filteredUsers = adminEmail ? users.filter(user => user.email !== adminEmail) : users;
    
    const usersWithPermissions = await Promise.all(
      filteredUsers.map(async (user) => ({
        ...user,
        permissions: await db.getUserPermissions(user.id)
      }))
    );
    console.log('Fetched users with permissions (excluding admin):', usersWithPermissions.length);
    res.json({ users: usersWithPermissions });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Delete user (requires admin permission)
router.delete('/users/:userId', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Prevent deleting admin user
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const adminUser = await db.findUserByEmail(adminEmail);
      if (adminUser && adminUser.id === userId) {
        return res.status(403).json({ message: 'Cannot delete admin user' });
      }
    }
    
    await db.deleteUser(userId);
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
    
    // Prevent modifying admin user's permissions
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const adminUser = await db.findUserByEmail(adminEmail);
      if (adminUser && adminUser.id === userId) {
        return res.status(403).json({ message: 'Cannot modify admin user permissions' });
      }
    }

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

// Get all containers for management
router.get('/containers', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    console.log('Fetching containers for user management');
    const containers = await dockerService.listContainers();
    console.log(`Docker service returned ${containers.length} containers`);
    containers.forEach((c, i) => console.log(`Container ${i}: ${c.name} (${c.id})`));
    
    // Check if current user is admin
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUser = adminEmail ? await db.findUserByEmail(adminEmail) : null;
    const isAdmin = adminUser?.id === req.user!.id;
    console.log(`User ${req.user!.email} is admin: ${isAdmin}`);
    
    let filteredContainers;
    if (isAdmin) {
      // Admin sees all containers
      filteredContainers = containers;
      console.log('Admin sees all containers');
    } else {
      // Regular users only see containers they have permissions for
      filteredContainers = [];
      for (const container of containers) {
        const userPermissions = db.getUserContainerPermissions(req.user!.id, container.id);
        console.log(`User has ${userPermissions.length} permissions on container ${container.id}`);
        if (userPermissions.length > 0) {
          filteredContainers.push(container);
        }
      }
      console.log(`Regular user sees ${filteredContainers.length} containers`);
    }
    
    res.json({ containers: filteredContainers });
  } catch (error) {
    console.error('Error fetching containers:', error);
    res.status(500).json({ message: 'Error fetching containers' });
  }
});

// Get all container permissions
router.get('/container-permissions', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const permissions = db.getContainerPermissions();
    res.json({ permissions });
  } catch (error) {
    console.error('Error fetching container permissions:', error);
    res.status(500).json({ message: 'Error fetching permissions' });
  }
});

// Get users permissions for a specific container
router.get('/containers/:id/users-permissions', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const containerId = req.params.id;
    const users = db.getUsers();
    
    // Filter out admin user
    const adminEmail = process.env.ADMIN_EMAIL;
    const filteredUsers = adminEmail ? users.filter(user => user.email !== adminEmail) : users;
    
    const usersWithPermissions = await Promise.all(
      filteredUsers.map(async (user) => ({
        ...user,
        permissions: db.getUserContainerPermissions(user.id, containerId)
      }))
    );
    console.log(`Fetched ${usersWithPermissions.length} users permissions for container ${containerId} (excluding admin)`);
    res.json({ users: usersWithPermissions });
  } catch (error) {
    console.error('Error fetching users permissions for container:', error);
    res.status(500).json({ message: 'Error fetching users permissions' });
  }
});

// Update user permissions for a specific container
router.post('/containers/:id/users/:userId/permissions', authenticate, requirePermission('user.change_permissions'), async (req, res) => {
  try {
    const { id: containerId, userId } = req.params;
    const { permissions } = req.body;
    
    // Prevent modifying admin user's permissions
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      const adminUser = await db.findUserByEmail(adminEmail);
      if (adminUser && adminUser.id === userId) {
        return res.status(403).json({ message: 'Cannot modify admin user permissions' });
      }
    }

    // Get current user's permissions on this container
    const currentUserPermissions = db.getUserContainerPermissions(req.user!.id, containerId);
    const currentUserPermissionIds = currentUserPermissions.map(p => p.id);

    // Filter requested permissions to only include those the current user has
    const allowedPermissions = permissions.filter((permissionId: number) => 
      currentUserPermissionIds.includes(permissionId)
    );

    // Remove all existing permissions for the target user
    db.removeAllUserContainerPermissions(userId, containerId);

    // Add only the allowed permissions
    for (const permissionId of allowedPermissions) {
      db.addUserContainerPermission(userId, containerId, permissionId);
    }

    res.json({ 
      message: 'Permissions updated successfully',
      granted: allowedPermissions.length,
      requested: permissions.length
    });
  } catch (error) {
    console.error('Error updating permissions:', error);
    res.status(500).json({ message: 'Error updating permissions' });
  }
});

export const authRoutes = router;
