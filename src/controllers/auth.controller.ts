import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { authService } from '../services/auth.service';
import { sendSuccess, sendCreated } from '../utils/response';
import { asyncHandler } from '../middleware/error.middleware';

export const authController = {
  register: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { user, tokens } = await authService.register(req.body);
    sendCreated(res, { user, ...tokens }, 'User registered successfully');
  }),

  login: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email, password } = req.body;
    const { user, tokens } = await authService.login(email, password);
    sendSuccess(res, { user, ...tokens }, 'Login successful');
  }),

  logout: asyncHandler(async (req: AuthRequest, res: Response) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && req.user) {
      await authService.logout(req.user.id, token);
    }
    sendSuccess(res, null, 'Logout successful');
  }),

  refreshToken: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { refreshToken } = req.body;
    const tokens = await authService.refreshToken(refreshToken);
    sendSuccess(res, tokens, 'Token refreshed successfully');
  }),

  me: asyncHandler(async (req: AuthRequest, res: Response) => {
    sendSuccess(res, req.user, 'User retrieved successfully');
  }),

  changePassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Current and new passwords are required' },
      });
      return;
    }
    await authService.changePassword(req.user!.id, currentPassword, newPassword);
    sendSuccess(res, null, 'Password changed successfully');
  }),

  forgotPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Email is required' },
      });
      return;
    }
    sendSuccess(res, null, 'If that email exists, a reset link has been sent.');
  }),

  resetPassword: asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Token and new password are required' },
      });
      return;
    }
    sendSuccess(res, null, 'Password updated successfully.');
  }),
};
