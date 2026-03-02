import { Router } from 'express';
import {
  addRfidTag,
  addRfidTagForCurrentBeer,
  clearCurrentRfidBeer,
  getCurrentRfidBeer,
  setCurrentRfidBeer,
} from '../controllers/rfidTag.controller';

const router = Router();

router.post('/add', addRfidTag);
router.get('/current-beer', getCurrentRfidBeer);
router.post('/current-beer', setCurrentRfidBeer);
router.delete('/current-beer', clearCurrentRfidBeer);
router.post('/scan-current', addRfidTagForCurrentBeer);

export default router;
