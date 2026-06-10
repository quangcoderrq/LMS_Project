import { BUCKET_NAME, MINIO_ENDPOINT } from '@/constants/env';
import { minioClient } from '../config/minio';
import { v4 } from 'uuid';
import mime from 'mime-types';
import { nowLocal } from './time';
import AppError from './AppError';
import { INTERNAL_SERVER_ERROR } from '@/constants/http';
import AppErrorCode from '@/constants/appErrorCode';
import path from 'path';
import slugify from 'slugify';

/**
 * Tạo tên file an toàn cho storage (MinIO/S3)
 * @param originalName Tên file gốc từ client
 * @returns Tên file đã slugify, giữ extension
 */
const decodeOriginalName = (name: string) => Buffer.from(name, 'latin1').toString('utf8');

export const slugifyFileName = (originalNameRaw: string) => {
  const originalName = decodeOriginalName(originalNameRaw);

  // Lấy extension
  const ext = path.extname(originalName); // ví dụ: '.png'
  const nameWithoutExt = path.basename(originalName, ext);

  // Slugify phần tên file
  const safeName = slugify(nameWithoutExt, {
    replacement: '-', // thay khoảng trắng bằng '-'
    remove: /[<>:"/\\|?*~`!@#$%^&+=]/g, // loại bỏ các ký tự đặc biệt
    lower: true, // chuyển thành chữ thường
    strict: true, // chỉ giữ chữ, số và replacement
    locale: 'vi', // hỗ trợ tiếng Việt
    trim: true, // bỏ dấu '-' ở đầu/cuối
  });

  // Ghép lại với extension
  return `${safeName}${ext.toLowerCase()}`;
};

/**
 * Upload 1 file, trả về public URL
 * @param file
 * @param prefix - Optional prefix string, defaults to prefixLessonMaterial with dummy ObjectIds
 * @returns
 */
export const uploadFile = async (file: Express.Multer.File, prefix: string) => {
  try {
    const decodedName = decodeOriginalName(file.originalname);
    const key = `${prefix}/${v4()}/${slugifyFileName(file.originalname)}`;
    await minioClient.putObject(BUCKET_NAME, key, file.buffer, file.size, {
      'Content-Type': mime.lookup(file.originalname) || 'application/octet-stream',
    });

    // URL public
    const publicUrl = `https://${MINIO_ENDPOINT}/${BUCKET_NAME}/${key}`;

    return {
      publicUrl,
      key,
      originalName: decodedName,
      mimeType: mime.lookup(file.originalname),
      size: file.size,
    };
  } catch (error) {
    throw new AppError(
      `Upload file error ${(error as Error).message}`,
      INTERNAL_SERVER_ERROR,
      AppErrorCode.UploadFileError
    );
  }
};

/**
 * Upload nhiều file, trả về public URLs
 * @param files
 * @returns
 */
export const uploadFiles = async (files: Express.Multer.File[], prefix: string) => {
  const uploaded = [];
  for (const file of files) {
    const res = await uploadFile(file, prefix);
    uploaded.push(res);
  }
  return uploaded;
};

/**
 * Trả về stream để download (proxy)
 * @param key
 * @returns
 */
export const getFile = async (key: string) => {
  try {
    return await minioClient.getObject(BUCKET_NAME, key);
  } catch (error) {
    throw new AppError(`Get file error ${(error as Error).message}`, INTERNAL_SERVER_ERROR);
  }
};

/**
 *
 * @param key
 * @returns
 */
export const getPublicUrl = (key: string) => `https://${MINIO_ENDPOINT}/${BUCKET_NAME}/${key}`;

/**
 *
 * @param publicUrl
 * @returns
 */
export const getKeyFromPublicUrl = (publicUrl: string) =>
  publicUrl.replace(`https://${MINIO_ENDPOINT}/${BUCKET_NAME}/`, '');

/**
 * method to get signed url
 * @param key
 * @param expiresIn
 * @returns
 */
export const getSignedUrl = (
  key: string,
  filename: string,
  expiresIn = 24 * 60 * 60,
  disposition: 'inline' | 'attachment' = 'inline'
) => {
  try {
    const encodedFilename = encodeURIComponent(filename || '');
    const dispositionValue = disposition === 'attachment'
      ? `attachment; filename="${nowLocal()}_${v4()}_${encodedFilename}"`
      : `inline; filename="${encodedFilename}"`;

    return minioClient.presignedGetObject(BUCKET_NAME, key, expiresIn, {
      'response-content-disposition': dispositionValue,
    });
  } catch (error) {
    throw new AppError(`Get signed url error ${(error as Error).message}`, INTERNAL_SERVER_ERROR);
  }
};

/**
 * Xóa file
 * @param key
 * @returns
 */
export const removeFile = async (key: string) => {
  try {
    console.log('KEY:', key, ' typeof key:', typeof key);
    return await minioClient.removeObject(BUCKET_NAME, key);
  } catch (error) {
    throw new AppError(`Remove file error ${error as Error}`, INTERNAL_SERVER_ERROR);
  }
};

/**
 * Xóa nhiều file
 * @param keys
 * @returns
 */
export const removeFiles = async (keys: string[]) => {
  try {
    return await minioClient.removeObjects(BUCKET_NAME, keys);
  } catch (error) {
    throw new AppError(`Remove files error ${(error as Error).message}`, INTERNAL_SERVER_ERROR);
  }
};

/**
 * Thông tin file
 * @param key
 * @returns
 */
export const getStatFile = async (key: string) => {
  try {
    return await minioClient.statObject(BUCKET_NAME, key);
  } catch (error) {
    throw new AppError(`Get stat file error ${(error as Error).message}`, INTERNAL_SERVER_ERROR);
  }
};

/**
 * Xóa nhiều file by prefix
 * @param keys
 * @returns
 */
export async function deleteFilesByPrefix(prefix: string) {
  console.log(`🧹 Starting deletion in prefix "${prefix}"...`);
  let totalDeleted = 0;
  const failed: string[] = [];

  try {
    let startAfter: string | undefined = undefined;

    while (true) {
      const objectsList: string[] = [];

      // ✅ 1. Lấy 1 batch file (tối đa ~1000)
      await new Promise<void>((resolve, reject) => {
        const stream = minioClient.listObjectsV2(BUCKET_NAME, prefix, true, startAfter);

        stream.on('data', (obj) => {
          if (obj.name) {
            objectsList.push(obj.name);
            startAfter = obj.name; // lưu lại để phân trang batch kế tiếp
          }
        });

        stream.on('end', () => resolve());
        stream.on('error', (err) => {
          console.error('❌ Error when listing objects:', err);
          reject(err);
        });
      });

      // ✅ 2. Nếu không còn file nào → dừng
      if (objectsList.length === 0) {
        console.log(`✅ No more files found in prefix "${prefix}".`);
        break;
      }

      console.log(`📦 Found ${objectsList.length} files, deleting...`);

      // ✅ 3. Xóa từng file trong batch
      for (const fileKey of objectsList) {
        try {
          await minioClient.removeObject(BUCKET_NAME, fileKey);
          console.log(`🗑️ Deleted: ${fileKey}`);
          totalDeleted++;
        } catch (err) {
          console.error(`❌ Error deleting ${fileKey}:`, err);
          failed.push(fileKey);
        }
      }

      // ✅ 4. Nếu < 1000 file thì không cần lặp tiếp
      if (objectsList.length < 1000) break;
    }

    // ✅ 5. Kết quả cuối cùng
    console.log(`✅ Finished! Deleted ${totalDeleted} file(s) from prefix "${prefix}".`);
    if (failed.length > 0) {
      console.warn(`⚠️ Failed to delete ${failed.length} files:\n${failed.join('\n')}`);
    }
  } catch (err) {
    console.error(`🚨 Fatal error while deleting prefix "${prefix}":`, err);
  }
}
