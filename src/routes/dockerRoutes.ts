import express from 'express';
import dockerService from '../services/dockerService';
import { authenticate, requirePermission } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all Docker routes
router.use(authenticate);

// List all containers
router.get('/containers', requirePermission('container.view'), async (req, res, next) => {
  try {
    const containers = await dockerService.listContainers();
    res.json(containers);
  } catch (error) {
    next(error);
  }
});

// Get a specific container by ID
router.get('/containers/:id', requirePermission('container.view'), async (req, res, next) => {
  try {
    const container = await dockerService.getContainerById(req.params.id);
    res.json(container);
  } catch (error) {
    next(error);
  }
});

// Start a container
router.post('/containers/:id/start', requirePermission('container.start'), async (req, res, next) => {
  try {
    await dockerService.startContainer(req.params.id);
    res.json({ success: true, message: 'Container started' });
  } catch (error) {
    next(error);
  }
});

// Stop a container
router.post('/containers/:id/stop', requirePermission('container.stop'), async (req, res, next) => {
  try {
    await dockerService.stopContainer(req.params.id);
    res.json({ success: true, message: 'Container stopped' });
  } catch (error) {
    next(error);
  }
});

// Restart a container
router.post('/containers/:id/restart', requirePermission('container.start', 'container.stop'), async (req, res, next) => {
  try {
    await dockerService.restartContainer(req.params.id);
    res.json({ success: true, message: 'Container restarted' });
  } catch (error) {
    next(error);
  }
});

export { router as dockerRoutes };
