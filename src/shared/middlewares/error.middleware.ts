import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { ApiError } from "../utils/apiError";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { MESSAGES } from "../constants/messages";

export const errorMiddleware = (
  err: any,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  if (err instanceof ApiError) {
    sendResponse(res, err.statusCode, err.message, err.details ?? null);
    return;
  }

  logger.error(`Unhandled error: ${err?.message || err}`);
  sendResponse(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    MESSAGES.INTERNAL_ERROR,
    err?.message
  );
};

export default errorMiddleware;
