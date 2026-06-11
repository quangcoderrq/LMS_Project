import { CookieOptions, Response } from 'express';
import { fifteenMinutesFromNow, thirtyDaysFromNow } from './date';

const isProduction = process.env.NODE_ENV === 'production';

export const REFRESH_PATH = '/auth/refresh';

const defaults: CookieOptions = {
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  httpOnly: true,
};

export const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...defaults,
  expires: fifteenMinutesFromNow(),
  path: '/',
});

export const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...defaults,
  expires: thirtyDaysFromNow(),
  path: '/',
});

type Params = {
  res: Response;
  accessToken: string;
  refreshToken: string;
};

export const setAuthCookies = ({ res, accessToken, refreshToken }: Params) => {
  return res
    .cookie('accessToken', accessToken, getAccessTokenCookieOptions())
    .cookie('refreshToken', refreshToken, getRefreshTokenCookieOptions());
};

export const clearAuthCookies = (res: Response) => {
  return res
    .clearCookie('accessToken', { path: '/' })
    .clearCookie('refreshToken', { path: '/' });
};