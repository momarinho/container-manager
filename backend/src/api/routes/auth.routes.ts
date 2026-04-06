import { Router } from 'express';
import { login, verify, validate } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
const router = Router();
router.post('/login', login);
router.get('/verify', authMiddleware, verify);
router.post('/validate', validate);
router.get('/validate', validate);
export default router;
