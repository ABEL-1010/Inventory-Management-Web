import express from 'express';
import { getDashboardStats } from '../controllers/statusControllers.js';
import { protect, admin } from '../middleware/authMiddleware.js';

const statsRoutes = express.Router();
statsRoutes.get('/', protect, getDashboardStats);

export default statsRoutes;
