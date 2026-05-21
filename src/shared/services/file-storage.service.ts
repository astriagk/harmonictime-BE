import { v4 as uuidv4 } from "uuid";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "../config/env";
import logger from "../utils/logger";

const s3Client = new S3Client({
  region: env.STORAGE_REGION,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

const BUCKET_NAME = env.STORAGE_BUCKET_NAME;

// Upload a file buffer to S3 under {folder}/{uuid}-{timestamp} and return its
// public HTTPS URL. Requires multer memory storage so `file.buffer` is set.
export const uploadFile = async (
  file: Express.Multer.File,
  folder: string
): Promise<string> => {
  const fileName = `${folder}/${uuidv4()}-${Date.now()}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  return `https://${BUCKET_NAME}.s3.${env.STORAGE_REGION}.amazonaws.com/${fileName}`;
};

// Delete a file given either its public S3 URL or its raw object key. Swallows
// errors so a failed delete never blocks the caller.
export const deleteFile = async (urlOrKey: string): Promise<void> => {
  if (!urlOrKey) return;

  try {
    // AWS S3 URL format: https://bucket.s3.region.amazonaws.com/folder/filename
    const objectKey = /^https?:\/\//i.test(urlOrKey)
      ? new URL(urlOrKey).pathname.substring(1) // strip leading slash
      : urlOrKey;

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
    });

    await s3Client.send(command);
  } catch (error) {
    logger.error(`Failed to delete cloud file: ${urlOrKey}`, error);
  }
};
