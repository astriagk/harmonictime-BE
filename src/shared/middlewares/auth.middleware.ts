import { Request, Response, NextFunction } from "express";
import { verifyToken, TokenPayload } from "../services/token.service";
import { sendResponse } from "../utils/apiResponse";
import { HTTP_STATUS } from "../constants/httpStatus";
import { MESSAGES } from "../constants/messages";
import { userRepository } from "../../modules/users/user/user.repository";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    sendResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.UNAUTHORIZED);
    return;
  }

  try {
    req.user = verifyToken(token);
  } catch {
    sendResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.INVALID_TOKEN);
    return;
  }

  try {
    const user = await userRepository.findById(req.user!.userId);
    if (!user) {
      sendResponse(res, HTTP_STATUS.UNAUTHORIZED, MESSAGES.UNAUTHORIZED);
      return;
    }
    if (user.status === "blocked") {
      sendResponse(res, HTTP_STATUS.FORBIDDEN, "Your account has been blocked. Please contact support.");
      return;
    }
    if (user.status === "suspended") {
      sendResponse(res, HTTP_STATUS.FORBIDDEN, "Your account has been temporarily suspended. Please contact support.");
      return;
    }
  } catch {
    sendResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, "Authentication error");
    return;
  }

  next();
};

export default authMiddleware;
