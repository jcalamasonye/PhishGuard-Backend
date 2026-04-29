import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validateBody } from '../middleware/validate.middleware';
import { loginSchema, registerSchema } from '../utils/validation';
import { strictRateLimiter } from '../middleware/security.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', strictRateLimiter, validateBody(registerSchema), authController.register);
router.post('/login', strictRateLimiter, validateBody(loginSchema), authController.login);
router.post('/logout', authenticate, authController.logout);
router.post('/refresh', authController.refreshToken);
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, authController.changePassword);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

export default router;
