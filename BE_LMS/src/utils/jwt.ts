import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { Role, ISession as SessionDocument } from '@/types';
import { IUser as UserDocument } from '@/types';
import { JWT_REFRESH_SECRET, JWT_SECRET } from '../constants/env';

export type RefreshTokenPayload = {
  sessionId: SessionDocument['_id'];
};
export type AccessTokenPayload = {
  userId: UserDocument['_id'];
  role: Role;
  sessionId: SessionDocument['_id'];
};

type SignOptionsAndSecret = SignOptions & { secret: string };

const defaults: SignOptions = {
  audience: 'user',
};

const accessTokenSignOptions: SignOptionsAndSecret = {
  expiresIn: '15m',
  secret: JWT_SECRET,
};

export const refreshTokenSignOptions: SignOptionsAndSecret = {
  expiresIn: '30d',
  secret: JWT_REFRESH_SECRET,
};

export const signToKen = (
  payload: RefreshTokenPayload | AccessTokenPayload,
  options?: SignOptionsAndSecret
) => {
  const { secret, ...signOpts } = options || accessTokenSignOptions;
  return jwt.sign(payload, secret, { ...defaults, ...signOpts });
};

export const verifyToken = <TPayload extends object = AccessTokenPayload>(
  token: string,
  options?: VerifyOptions & { secret?: string }
) => {
  const { secret = JWT_SECRET, ...verifyOpts } = options || {};
  try {
    const payload = jwt.verify(token, secret, {
      ...(defaults as VerifyOptions),
      ...verifyOpts,
    }) as TPayload;
    return { payload };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
};
