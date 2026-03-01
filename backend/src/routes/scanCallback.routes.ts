import { Router } from 'express'
import {
  initScanCallback,
  sendScanCallback
} from '../controllers/scanCallback.controller';

const router = Router()


// GET  /api/scan_callback/events  → abonne un client SSE
router.get('/events', initScanCallback);

// POST /api/scan_callback         → reçoit les callbacks Python
router.post('/', sendScanCallback);

export default router
