import { Request, Response, NextFunction } from "express";
import { ObjectSchema } from "joi";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { MESSAGES } from "../constants/messages";

// Validates req.body against a Joi schema; replaces body with the sanitised value.
export const validate =
  (schema: ObjectSchema) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) {
      sendResponse(
        res,
        HTTP_STATUS.BAD_REQUEST,
        MESSAGES.VALIDATION_ERROR,
        error.details
      );
      return;
    }
    req.body = value;
    next();
  };
