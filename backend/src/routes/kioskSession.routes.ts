import { Router } from 'express';
import {
  clearCurrentKioskUser,
  getCurrentKioskUser,
  setCurrentKioskUser,
} from '../controllers/kioskSession.controller';

const router = Router();

router.get('/current', getCurrentKioskUser);
router.post('/current', setCurrentKioskUser);
router.delete('/current', clearCurrentKioskUser);

export default router;
