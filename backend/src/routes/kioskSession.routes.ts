import { Router } from 'express';
import {
  acknowledgeMotorAction,
  clearCurrentKioskUser,
  getCurrentKioskUser,
  setCurrentKioskUser,
} from '../controllers/kioskSession.controller';

const router = Router();

router.get('/current', getCurrentKioskUser);
router.post('/current', setCurrentKioskUser);
router.delete('/current', clearCurrentKioskUser);
router.delete('/current/motor-action', acknowledgeMotorAction);

export default router;
