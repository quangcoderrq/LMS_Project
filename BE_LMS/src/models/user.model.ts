import mongoose from 'mongoose';
import { compareValue, hashValue } from '../utils/bcrypt';
import { Role, IUser, UserStatus } from '../types';
import { EMAIL_REGEX, INTERNATIONAL_PHONE_REGEX, VIETNAM_PHONE_REGEX } from '../constants/regex';

const UserSchema = new mongoose.Schema<IUser>(
  {
    username: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      match: EMAIL_REGEX,
      trim: true,
    },
    password: { type: String, required: true, minLength: 6 },
    role: { type: String, required: true, default: Role.STUDENT },
    fullname: { type: String, maxLength: 100, trim: true },
    phone_number: {
      type: String,
      match: VIETNAM_PHONE_REGEX || INTERNATIONAL_PHONE_REGEX,
    },
    avatar_url: { type: String },
    key: { type: String },
    bio: { type: String },
    isVerified: { type: Boolean, required: true, default: false },
    status: { type: String, required: true, default: UserStatus.ACTIVE },
    specialistIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Specialist' }],
    googleId: { type: String, sparse: true },
  },
  {
    timestamps: true,
  }
);

//indexes
UserSchema.index({ username: 1 }, { unique: true });
UserSchema.index({ email: 1 }, { unique: true, sparse: true });
UserSchema.index({ phone_number: 1 }, { unique: true, sparse: true });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ specialistIds: 1 }); //multikey index

// Middleware "pre-save" trong Mongoose:
// Hàm này sẽ tự động chạy TRƯỚC KHI document được lưu (save) vào MongoDB
UserSchema.pre('save', async function (next) {
  // ✅ Kiểm tra xem field "password" có bị thay đổi không
  // Nếu KHÔNG thay đổi (ví dụ chỉ update email, name,...) thì bỏ qua việc hash lại
  if (!this.isModified('password')) return next();

  // ✅ Nếu password đã thay đổi hoặc là lần đầu tạo user,
  // thì hash lại password trước khi lưu vào database
  this.password = await hashValue(this.password);

  // ✅ Gọi next() để cho phép Mongoose tiếp tục quá trình lưu document
  next();
});

UserSchema.methods.comparePassword = async function (value: string) {
  return await compareValue(value, this.password);
};

UserSchema.methods.omitPassword = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

UserSchema.methods.response = function (viewerRole: Role = Role.STUDENT) {
  const baseData = {
    fullname: this.fullname,
    avatar_url: this.avatar_url,
    bio: this.bio,
    role: this.role,
  };

  if (viewerRole === Role.TEACHER) {
    return {
      ...baseData,
      email: this.email,
      phone_number: this.phone_number,
    };
  }

  if (viewerRole === Role.ADMIN) {
    return {
      ...this.toObject(),
      password: undefined,
    };
  }

  // public
  return baseData;
};

const UserModel = mongoose.model<IUser>('User', UserSchema, 'users');
export default UserModel;
