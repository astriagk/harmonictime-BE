import { Response } from "express";

// Uniform success/error envelope. Kept backwards-compatible with the previous
// sendResponse signature: { message, data }.
export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data: any = null
): void => {
  res.status(statusCode).json({ message, data });
};
