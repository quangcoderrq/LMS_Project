import { Router } from 'express';
import {
  googleLoginHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  registerHandler,
  resendVerifyEmailHandler,
  resetPasswordHandler,
  sendPasswordResetHandler,
  verifyEmailHandler,
} from '../controller/auth.controller';

const appRoutes = Router();

//prefix: /auth

appRoutes.post('/register', registerHandler);
appRoutes.post('/login', loginHandler);
appRoutes.post('/google', googleLoginHandler);
appRoutes.get('/logout', logoutHandler);
appRoutes.post('/refresh', refreshHandler);
appRoutes.get('/email/verify/:code', verifyEmailHandler);
appRoutes.post('/password/forgot', sendPasswordResetHandler);
appRoutes.post('/password/reset', resetPasswordHandler);
appRoutes.post('/auth/resend-verify-email', resendVerifyEmailHandler);

export const authRoutes = appRoutes;

export default appRoutes;
