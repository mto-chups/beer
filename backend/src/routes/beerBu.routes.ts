import { Router } from 'express';
import { consumeBeer, showBacPage, getBacData} from '../controllers/beerBu.controller';


const router = Router();

// POST (body)
router.post('/consume', consumeBeer);
router.get('/bac/:userId',      showBacPage);
router.get('/bac/data/:userId', getBacData);
export default router;