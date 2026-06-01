import multer from "multer";

// Memory storage so `file.buffer` is available for the S3 upload. Accepts
// images (and application/octet-stream, common from mobile clients) up to 10MB.
const storage = multer.memoryStorage();

export const uploadMiddleware = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype === "application/octet-stream" ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Only images, videos, and PDFs are allowed.`));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
