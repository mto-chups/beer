import { Router } from 'express';
import { addUser, getUsers, deleteUser, updateUserTeam, updateUser} from '../controllers/user.controller';

const router = Router();

router.post('/', addUser);
router.get('/', getUsers);
router.delete('/:id', deleteUser);
router.patch('/:id/team', updateUserTeam);
router.patch('/:id', updateUser); // ajoute cette ligne

export default router;
