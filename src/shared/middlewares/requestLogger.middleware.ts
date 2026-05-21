import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";

export const requestLogger = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  logger.info(`Incoming request: ${req.method} ${req.url}`);
  next();
};

export default requestLogger;
