// src/routes/manualBonus.routes.ts
import { Router } from 'express';
import { addManualBonus } from '../controllers/manualBonus.controller';

const router = Router();

// ← ici, on monte la route POST /
router.post('/', addManualBonus);

export default router;
