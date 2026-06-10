import dotenv from "dotenv";

dotenv.config();

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;

  if (value === undefined) {
    throw new Error(`Environment variable ${key} is missing`);
  }

  return value;
};

export const MONGO_URI = getEnv("MONGO_URI");
export const NODE_ENV = getEnv("NODE_ENV", "development");
export const JWT_SECRET = getEnv("JWT_SECRET", "secret");
export const JWT_REFRESH_SECRET = getEnv(
  "JWT_REFRESH_SECRET",
  "refresh_secret"
);
export const APP_ORIGIN = getEnv("APP_ORIGIN", "http://localhost:3000");
export const EMAIL_SENDER = getEnv("EMAIL_SENDER", "anhkn7@gmail.com");
export const RESEND_API_KEY = getEnv("RESEND_API_KEY", "");
export const PORT = getEnv("PORT", "4004");
export const GOOGLE_CLIENT_ID = getEnv("GOOGLE_CLIENT_ID", "");
export const GOOGLE_CLIENT_SECRET = getEnv("GOOGLE_CLIENT_SECRET", "");

//BUCKET
export const BUCKET_NAME = getEnv("BUCKET_NAME");
export const MINIO_ENDPOINT = getEnv("MINIO_ENDPOINT");
export const MINIO_PORT = Number(getEnv("MINIO_PORT", "443"));
export const MINIO_USE_SSL =
  getEnv("MINIO_USE_SSL", "true") === "true" ? true : false;
export const MINIO_ACCESS_KEY = getEnv("MINIO_ACCESS_KEY");
export const MINIO_SECRET_KEY = getEnv("MINIO_SECRET_KEY");
