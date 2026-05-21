import jwt from "jsonwebtoken";
import { env } from "../config/env";

export interface TokenPayload {
  userId: string;
  email: string;
}

export const signToken = (
  payload: TokenPayload,
  expiresIn: string = env.JWT_EXPIRES_IN
): string => jwt.sign(payload, env.JWT_SECRET, { expiresIn } as jwt.SignOptions);

export const verifyToken = (token: string): TokenPayload =>
  jwt.verify(token, env.JWT_SECRET) as TokenPayload;
