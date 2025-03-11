import express from 'express';
import dockerService from '../services/dockerService';

const router = express.Router();

// List all containers
router.get('/containers', async (req, res, next) => {
  try {
    const containers = await dockerService.listContainers();
    res.json(containers);
  } catch (error) {
    next(error);
  }
});

// Start a container
router.post('/containers/:id/start', async (req, res, next) => {
  try {
    await dockerService.startContainer(req.params.id);
    res.json({ success: true, message: 'Container started' });
  } catch (error) {
    next(error);
  }
});

// Stop a container
router.post('/containers/:id/stop', async (req, res, next) => {
  try {
    await dockerService.stopContainer(req.params.id);
    res.json({ success: true, message: 'Container stopped' });
  } catch (error) {
    next(error);
  }
});

// Restart a container
router.post('/containers/:id/restart', async (req, res, next) => {
  try {
    await dockerService.restartContainer(req.params.id);
    res.json({ success: true, message: 'Container restarted' });
  } catch (error) {
    next(error);
  }
});


export { router as dockerRoutes };
