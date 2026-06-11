import { MongoClient, Db } from "mongodb";
import { env } from "./env";
import logger from "../utils/logger";

let db: Db;

export const connectDB = async (): Promise<Db> => {
  if (db) return db;
  const client = new MongoClient(env.MONGO_URI, {
    tls: true,
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  db = client.db(env.DB_NAME);
  logger.info("Database connected successfully");
  return db;
};

export const getDB = (): Db => {
  if (!db) {
    throw new Error("Database not initialised. Call connectDB() first.");
  }
  return db;
};
