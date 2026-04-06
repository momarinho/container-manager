import { Router } from 'express';
import { login, verify, validate } from '../controllers/auth.controller';
const router = Router();
router.post('/login', login);
router.get('/verify', verify);
router.post('/validate', validate);
router.get('/validate', validate);
export default router;
