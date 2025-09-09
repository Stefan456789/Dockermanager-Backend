import express from 'express';
import dockerService from '../services/dockerService';
import { authenticate, requirePermission, requireContainerPermission } from '../middleware/authMiddleware';
import * as db from '../models/database';

const router = express.Router();

// Apply authentication middleware to all Docker routes
router.use(authenticate);

// List all containers
router.get('/containers', authenticate, async (req, res, next) => {
  try {
    const containers = await dockerService.listContainers();
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    // Filter containers where user has 'view' permission
    const filteredContainers = containers.filter(container =>
      db.hasContainerPermission(req.user!.id, container.id, 'view')
    );
    res.json(filteredContainers);
  } catch (error) {
    next(error);
  }
});

// Get a specific container by ID
router.get('/containers/:id', requireContainerPermission('view'), async (req, res, next) => {
  try {
    const container = await dockerService.getContainerById(req.params.id);
    res.json(container);
  } catch (error) {
    next(error);
  }
});

// Start a container
router.post('/containers/:id/start', requireContainerPermission('start'), async (req, res, next) => {
  try {
    await dockerService.startContainer(req.params.id);
    res.json({ success: true, message: 'Container started' });
  } catch (error) {
    next(error);
  }
});

// Stop a container
router.post('/containers/:id/stop', requireContainerPermission('stop'), async (req, res, next) => {
  try {
    await dockerService.stopContainer(req.params.id);
    res.json({ success: true, message: 'Container stopped' });
  } catch (error) {
    next(error);
  }
});

// Restart a container
router.post('/containers/:id/restart', requireContainerPermission('restart'), async (req, res, next) => {
  try {
    await dockerService.restartContainer(req.params.id);
    res.json({ success: true, message: 'Container restarted' });
  } catch (error) {
    next(error);
  }
});

export { router as dockerRoutes };
