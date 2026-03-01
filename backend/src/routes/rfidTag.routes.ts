import { Router } from 'express';
import { addRfidTag } from '../controllers/rfidTag.controller';

const router = Router();

router.post('/add', addRfidTag);

export default router;
