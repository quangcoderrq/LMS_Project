import { catchErrors } from '../utils/asyncHandler';
import { CREATED, OK, UNAUTHORIZED } from '../constants/http';
import {
  createAccount,
  loginUser,
  refreshUserAccessToken,
  resendVerifyEmail,
  resetPassword,
  sendPasswordResetEmail,
  verifyEmail,
} from '@/services/auth.service';
import {
  clearAuthCookies,
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  setAuthCookies,
} from '@/utils/cookies';
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verificationCodeSchema,
} from '@/validators/auth.schemas';
import { verifyToken } from '../utils/jwt';
import { SessionModel } from '@/models';
import appAssert from '../utils/appAssert';

//controller architecture
// - validate request
// - call service
// - return response

export const registerHandler = catchErrors(async (req, res) => {
  //validate request
  const request = registerSchema.parse({
    ...req.body,
    useAgent: req.headers['user-agent'],
  });

  const { user } = await createAccount(request);

  return res.success(CREATED, {
    data: user,
    message: 'Account created successfully, please verify your email',
  });
});

export const loginHandler = catchErrors(async (req, res) => {
  //validate request
  const request = loginSchema.parse({
    ...req.body,
    userAgent: req.headers['user-agent'],
  });

  const { user, refreshToken, accessToken } = await loginUser(request);

  return setAuthCookies({ res, accessToken, refreshToken }).success(OK, {
    data: user,
    message: 'Login successfully',
  });
});

export const logoutHandler = catchErrors(async (req, res) => {
  const accessToken = req.cookies.accessToken as string | undefined;
  const { payload } = verifyToken(accessToken || '', {
    ignoreExpiration: true,
  });

  if (payload) {
    await SessionModel.findByIdAndDelete(payload.sessionId);
  }

  return clearAuthCookies(res).success(OK, {
    message: 'Logout successfully',
  });
});

export const refreshHandler = catchErrors(async (req, res) => {
  const refreshToken = req.cookies.refreshToken as string | undefined;
  appAssert(refreshToken, UNAUTHORIZED, 'Missing refresh token');

  const { accessToken, refreshToken: newRefreshToken } = await refreshUserAccessToken(refreshToken);

  if (newRefreshToken) {
    res.cookie('refreshToken', newRefreshToken, getRefreshTokenCookieOptions());
  }

  return res.cookie('accessToken', accessToken, getAccessTokenCookieOptions()).success(OK, {
    message: 'Token refreshed successfully',
  });
});

export const verifyEmailHandler = catchErrors(async (req, res) => {
  const verificationCode = verificationCodeSchema.parse(req.params.code);

  //call service to verify email
  await verifyEmail(verificationCode);

  return res.success(OK, {
    message: 'Email verified successfully',
  });
});

export const sendPasswordResetHandler = catchErrors(async (req, res) => {
  const email = emailSchema.parse(req.body.email);
  await sendPasswordResetEmail(email);

  return res.success(OK, {
    message: 'Password reset email sent successfully',
    info: 'Check your email to reset your password',
  });
});

export const resetPasswordHandler = catchErrors(async (req, res) => {
  const { verificationCode, password } = req.body;
  const request = resetPasswordSchema.parse({ verificationCode, password });

  await resetPassword(request);

  return clearAuthCookies(res).success(OK, {
    message: 'Password reset successfully',
  });
});

export const resendVerifyEmailHandler = catchErrors(async (req, res) => {
  const email = emailSchema.parse(req.body.email);
  await resendVerifyEmail(email);

  return res.success(OK, {
    message: 'Verification email sent successfully',
    info: 'Check your email to verify your account',
  });
});
