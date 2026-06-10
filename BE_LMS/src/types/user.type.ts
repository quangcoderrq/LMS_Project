import mongoose from 'mongoose';

export enum Role {
  STUDENT = 'student',
  TEACHER = 'teacher',
  ADMIN = 'admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export default interface IUser extends mongoose.Document<mongoose.Types.ObjectId> {
  username: string;
  email: string;
  password: string;
  role: Role;
  fullname?: string;
  phone_number?: string;
  avatar_url?: string;
  key?: string;
  bio?: string;
  isVerified: boolean;
  status?: UserStatus;
  specialistIds: mongoose.Types.ObjectId[];
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;

  comparePassword(val: string): Promise<boolean>;

  omitPassword(): Omit<IUser, 'password'>;

  response(): IUser;
}
