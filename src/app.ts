import http from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { connectDB } from "./shared/config/database";
import { requestLogger } from "./shared/middlewares/requestLogger.middleware";
import { errorMiddleware } from "./shared/middlewares/error.middleware";
import logger from "./shared/utils/logger";
import routes from "./routes";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());
app.use(requestLogger);

connectDB()
  .then(() => logger.info("Connected to database"))
  .catch((err) => logger.error(`Database connection failed: ${err}`));

app.use("/api", routes);

// Central error handler — must be registered last.
app.use(errorMiddleware);

export const httpServer = http.createServer(app);
export default app;
