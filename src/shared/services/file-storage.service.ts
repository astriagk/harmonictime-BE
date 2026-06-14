import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import os from "os";
import path from "path";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { env } from "../config/env";
import logger from "../utils/logger";

ffmpeg.setFfmpegPath(ffmpegStatic as string);

const s3Client = new S3Client({
  region: env.STORAGE_REGION,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

const BUCKET_NAME = env.STORAGE_BUCKET_NAME;

// Compressible image types that sharp handles reliably.
const COMPRESSIBLE_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/tiff",
]);

// Compress a video buffer to H.264/AAC MP4 at CRF 28. Writes to temp files
// since ffmpeg cannot work with in-memory buffers directly. Falls back to the
// original if ffmpeg fails or the result is larger.
const compressVideo = (
  buffer: Buffer,
  mimetype: string,
): Promise<{ buffer: Buffer; mimetype: string }> => {
  if (!mimetype.startsWith("video/")) {
    return Promise.resolve({ buffer, mimetype });
  }

  const inputPath = path.join(os.tmpdir(), `${uuidv4()}-input`);
  const outputPath = path.join(os.tmpdir(), `${uuidv4()}-compressed.mp4`);

  return new Promise((resolve) => {
    fs.writeFileSync(inputPath, buffer);

    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",
        "-crf 28",
        "-preset fast",
        "-c:a aac",
        "-movflags +faststart",
      ])
      .output(outputPath)
      .on("end", () => {
        try {
          const compressed = fs.readFileSync(outputPath);

          if (compressed.length < buffer.length) {
            resolve({ buffer: compressed, mimetype: "video/mp4" });
          } else {
            resolve({ buffer, mimetype });
          }
        } finally {
          fs.rmSync(inputPath, { force: true });
          fs.rmSync(outputPath, { force: true });
        }
      })
      .on("error", (err) => {
        fs.rmSync(inputPath, { force: true });
        fs.rmSync(outputPath, { force: true });
        logger.warn("Video compression failed, uploading original", err);
        resolve({ buffer, mimetype });
      })
      .run();
  });
};

// Compress an image buffer to WebP at quality 80. WebP is 25-35% smaller than
// JPEG at the same perceptual quality. Falls back to the original if sharp
// fails or the result is larger than the input.
const compressImage = async (
  buffer: Buffer,
  mimetype: string,
): Promise<{ buffer: Buffer; mimetype: string }> => {
  if (!COMPRESSIBLE_IMAGE_TYPES.has(mimetype)) {
    return { buffer, mimetype };
  }

  try {
    const compressed = await sharp(buffer).webp({ quality: 80 }).toBuffer();

    if (compressed.length < buffer.length) {
      return { buffer: compressed, mimetype: "image/webp" };
    }
  } catch (err) {
    logger.warn("Image compression failed, uploading original", err);
  }

  return { buffer, mimetype };
};

// Upload a file buffer to S3 under {folder}/{uuid}-{timestamp} and return its
// public HTTPS URL. Images are compressed to WebP before upload. Requires
// multer memory storage so `file.buffer` is set.
export const uploadFile = async (
  file: Express.Multer.File,
  folder: string,
): Promise<string> => {
  const isVideo = file.mimetype.startsWith("video/");
  const { buffer, mimetype } = isVideo
    ? await compressVideo(file.buffer, file.mimetype)
    : await compressImage(file.buffer, file.mimetype);

  // Use .webp extension when the image was converted so the URL is correct.
  const ext =
    mimetype === "image/webp" && file.mimetype !== "image/webp" ? ".webp" : "";
  const fileName = `${folder}/${uuidv4()}-${Date.now()}${ext}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: fileName,
    Body: buffer,
    ContentType: mimetype,
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
