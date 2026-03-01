import { Router } from 'express';
import { consumeBeer, consumeBeerForCurrentUser, showBacPage, getBacData} from '../controllers/beerBu.controller';


const router = Router();

// POST (body)
router.post('/consume', consumeBeer);
router.post('/consume-current', consumeBeerForCurrentUser);
router.get('/bac/:userId',      showBacPage);
router.get('/bac/data/:userId', getBacData);
export default router;
