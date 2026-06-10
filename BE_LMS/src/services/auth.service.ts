import { Role } from '@/types';
import { APP_ORIGIN, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from '../constants/env';
import {
  CONFLICT,
  FORBIDDEN,
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  TOO_MANY_REQUESTS,
  UNAUTHORIZED,
} from '../constants/http';
import VerificationCodeType from '../constants/verificationCode';
import { UserModel, SessionModel, VerificationCodeModel } from '@/models';
import appAssert from '../utils/appAssert';
import { hashValue } from '../utils/bcrypt';
import {
  fiveMinutesAgo,
  ONE_DAY_MS,
  oneHourFromNow,
  onYearFromNow,
  thirtyDaysFromNow,
} from '../utils/date';
import { getPasswordResetTemplate, getVerifyEmailTemplate } from '../utils/emailTemplates';
import { RefreshTokenPayload, refreshTokenSignOptions, signToKen, verifyToken } from '@/utils/jwt';
import { sendMail } from '../utils/sendMail';
import { OAuth2Client } from 'google-auth-library';

export type CreateAccountParams = {
  username: string;
  email: string;
  password: string;
  userAgent?: string;
  fullname: string;
};

// Domain for teacher
const TEACHER_EMAIL_DOMAIN = '@fe.edu.vn';

export const createAccount = async (data: CreateAccountParams) => {
  //verify existing user does not exist
  const existingUser = await UserModel.exists({ email: data.email });
  // if (existingUser) throw new Error("User already exists");
  appAssert(!existingUser, CONFLICT, 'Email already in use');
  //check user name
  const usernameExists = await UserModel.exists({ username: data.username });
  appAssert(!usernameExists, CONFLICT, 'Username already in use');

  const role = data.email.endsWith(TEACHER_EMAIL_DOMAIN) ? Role.TEACHER : Role.STUDENT;

  //create user
  const user = await UserModel.create({
    username: data.username,
    email: data.email,
    password: data.password,
    fullname: data.fullname,
    role,
  });
  //create verification code
  const verificationCode = await VerificationCodeModel.create({
    userId: user._id,
    type: VerificationCodeType.VERIFY_EMAIL,
    email: data.email,
    expiresAt: onYearFromNow(),
  });
  //send verification email

  const url = `${APP_ORIGIN}/auth/verify-email/${verificationCode._id}`;
  const { error } = await sendMail({
    to: user.email,
    ...getVerifyEmailTemplate(url),
  });

  appAssert(!error, INTERNAL_SERVER_ERROR, 'Failed to send verification email');

  return {
    user: user.omitPassword(),
  };
};

export type LoginParams = {
  email: string;
  password: string;
  userAgent?: string;
};

export const loginUser = async ({ email, password, userAgent }: LoginParams) => {
  //get the user by email
  const user = await UserModel.findOne({ email });
  appAssert(user, UNAUTHORIZED, 'Invalid email or password');
  //check wether user is verified
  appAssert(user.isVerified, UNAUTHORIZED, 'Email not verified');
  //validate the password from request
  const isValidatePassword = await user.comparePassword(password);
  appAssert(isValidatePassword, UNAUTHORIZED, 'Invalid email or password');

  if (user.role === Role.STUDENT) {
    // Automatically invalidate any previous sessions for the student to enforce single session constraint
    // while preventing the student from being locked out if they cleared their cookies.
    await SessionModel.deleteMany({
      userId: user._id,
    });
  }

  //create session
  const session = await SessionModel.create({
    userId: user._id,
    userAgent,
  });
  //sign access token & refresh token
  const refreshToken = signToKen({ sessionId: session._id }, refreshTokenSignOptions);

  const accessToken = signToKen({
    userId: user._id,
    role: user.role,
    sessionId: session._id,
  });
  return {
    user: user.response(),
    accessToken,
    refreshToken,
  };

  //return user & tokens
};

export const refreshUserAccessToken = async (refreshToken: string) => {
  const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
    secret: refreshTokenSignOptions.secret,
  });

  appAssert(payload, UNAUTHORIZED, 'Invalid refresh token');

  const session = await SessionModel.findById(payload.sessionId);
  const now = Date.now();
  appAssert(session && session.expiresAt.getTime() > now, UNAUTHORIZED, 'Session expired');

  //Get user
  const user = await UserModel.findById(session.userId);
  appAssert(user, NOT_FOUND, 'User not found');

  //Refresh the token if it expires in less than 1 day
  const sessionNeedRefresh = session.expiresAt.getTime() - now <= ONE_DAY_MS;

  if (sessionNeedRefresh) {
    session.expiresAt = thirtyDaysFromNow();
    await session.save();
  }

  const newRefreshToken = sessionNeedRefresh
    ? signToKen({ sessionId: session._id }, refreshTokenSignOptions)
    : undefined;

  const accessToken = signToKen({
    userId: session.userId,
    role: user.role,
    sessionId: session._id,
  });

  return { accessToken, refreshToken: newRefreshToken };
};

export const verifyEmail = async (code: string) => {
  //get the verification code from db
  const validCode = await VerificationCodeModel.findOne({
    _id: code,
    type: VerificationCodeType.VERIFY_EMAIL,
    expiresAt: { $gt: new Date() },
  });
  appAssert(validCode, NOT_FOUND, 'Invalid or expired verification code');
  //get user by id
  //update user verified true
  const updatedUser = await UserModel.findByIdAndUpdate(
    validCode.userId,
    {
      isVerified: true,
    },
    { new: true }
  );
  appAssert(updatedUser, INTERNAL_SERVER_ERROR, 'Failed to verify email');
  //delete verification code record
  await validCode.deleteOne();
  //return user
  return {
    user: updatedUser.omitPassword(),
  };
};

export const sendPasswordResetEmail = async (email: string) => {
  //get the user by email
  const user = await UserModel.findOne({ email });
  appAssert(user, NOT_FOUND, 'User with this email does not exist');
  //check email rate limit
  const fiveMinAgo = fiveMinutesAgo();
  const count = await VerificationCodeModel.countDocuments({
    userId: user._id,
    type: VerificationCodeType.FORGOT_PASSWORD,
    createdAt: { $gt: fiveMinAgo },
  });
  appAssert(count <= 1, TOO_MANY_REQUESTS, 'Too many requests. Please try again later.');
  //create verification code
  const verificationCode = await VerificationCodeModel.create({
    userId: user._id,
    type: VerificationCodeType.FORGOT_PASSWORD,
    email: user.email,
    expiresAt: oneHourFromNow(),
  });
  //send email with the verification code
  const url = `${APP_ORIGIN}/password/reset?code=${
    verificationCode._id
  }&exp=${verificationCode.expiresAt.getTime()}`;
  const { data, error } = await sendMail({
    to: user.email,
    ...getPasswordResetTemplate(url),
  });
  appAssert(data?.id, INTERNAL_SERVER_ERROR, `${error?.name} - ${error?.message}`);
  //return success message
  return { url, emailId: data?.id };
};

type ResetPasswordParams = {
  verificationCode: string;
  password: string;
};
export const resetPassword = async ({ verificationCode, password }: ResetPasswordParams) => {
  //get the verification code from db
  const validCode = await VerificationCodeModel.findOne({
    _id: verificationCode,
    type: VerificationCodeType.FORGOT_PASSWORD,
    expiresAt: { $gt: new Date() },
  });
  appAssert(validCode, NOT_FOUND, 'Invalid or expired verification code');

  //get user by id
  //update user password
  const updatedUser = await UserModel.findByIdAndUpdate(validCode.userId, {
    password: await hashValue(password),
  });
  appAssert(updatedUser, INTERNAL_SERVER_ERROR, 'Failed to reset password');

  //delete verification code record
  await validCode.deleteOne();

  //delete all sessions of the user
  await SessionModel.deleteMany({ userId: updatedUser._id });

  return {
    user: updatedUser.omitPassword(),
  };
};

export const resendVerifyEmail = async (email: string) => {
  //get the user by email
  const user = await UserModel.findOne({ email });
  appAssert(user, NOT_FOUND, 'User with this email does not exist');

  //check email rate limit
  const fiveMinAgo = fiveMinutesAgo();
  const count = await VerificationCodeModel.countDocuments({
    userId: user._id,
    type: VerificationCodeType.VERIFY_EMAIL,
    createdAt: { $gt: fiveMinAgo },
  });
  appAssert(count <= 1, TOO_MANY_REQUESTS, 'Too many requests. Please try again later.');

  //create verification code
  const verificationCode = await VerificationCodeModel.create({
    userId: user._id,
    type: VerificationCodeType.VERIFY_EMAIL,
    email: user.email,
    expiresAt: onYearFromNow(),
  });
  //send verification email
  const url = `${APP_ORIGIN}/auth/verify-email/${verificationCode._id}`;
  const { data, error } = await sendMail({
    to: user.email,
    ...getVerifyEmailTemplate(url),
  });
  appAssert(!error, INTERNAL_SERVER_ERROR, `${error?.name} - ${error?.message}`);
  //return success message
  return { url, emailId: data?.id };
};

export type GoogleLoginParams = {
  code: string;
  userAgent?: string;
};

export const googleLogin = async ({ code, userAgent }: GoogleLoginParams) => {
  try {
    // Exchange authorization code for tokens
    const client = new OAuth2Client(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      APP_ORIGIN // Default redirect_uri used by @react-oauth/google library
    );
    
    // Get tokens - redirect_uri matches what library used
    const { tokens } = await client.getToken(code);
    const idToken = tokens.id_token;
    appAssert(idToken, UNAUTHORIZED, 'Failed to exchange authorization code');

    // Verify Google ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    appAssert(payload, UNAUTHORIZED, 'Invalid Google token');
    
    const { email, name, picture, sub: googleId } = payload;
    appAssert(email, UNAUTHORIZED, 'Email not provided by Google');
    
    // Find or create user
    let user = await UserModel.findOne({ email });
    
    if (!user) {
      // Create new user from Google data
      // Extract username from email (first part before @)
      let username = email.split('@')[0];
      
      // Check if username already exists, if so append random suffix
      let usernameExists = await UserModel.exists({ username });
      if (usernameExists) {
        username = `${username}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      const role = email.endsWith(TEACHER_EMAIL_DOMAIN) ? Role.TEACHER : Role.STUDENT;
      
      // Create user with random password (won't be used for Google login)
      const randomPassword = Math.random().toString(36).slice(-12);
      
      user = await UserModel.create({
        email,
        username,
        fullname: name || email,
        password: randomPassword,
        avatar_url: picture,
        role,
        isVerified: true, // Google users are automatically verified
        googleId,
      });
    } else if (!user.isVerified) {
      // If user exists but not verified, verify them now
      user.isVerified = true;
      user.googleId = googleId;
      if (picture && !user.avatar_url) {
        user.avatar_url = picture;
      }
      await user.save();
    }
    
    // If it's a student, delete previous sessions (single session constraint)
    if (user.role === Role.STUDENT) {
      await SessionModel.deleteMany({ userId: user._id });
    }
    
    // Create session
    const session = await SessionModel.create({
      userId: user._id,
      userAgent,
    });
    
    // Sign tokens
    const refreshToken = signToKen({ sessionId: session._id }, refreshTokenSignOptions);
    const accessToken = signToKen({
      userId: user._id,
      role: user.role,
      sessionId: session._id,
    });
    
    return {
      user: user.response(),
      accessToken,
      refreshToken,
    };
  } catch (error: any) {
    console.error('Google login error:', error);
    appAssert(false, UNAUTHORIZED, error?.message || 'Invalid authorization code');
  }
};
