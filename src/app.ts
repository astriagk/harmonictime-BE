import http from "http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { requestLogger } from "./shared/middlewares/requestLogger.middleware";
import { errorMiddleware } from "./shared/middlewares/error.middleware";
import routes from "./routes";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(helmet());
app.use(requestLogger);

app.use("/api", routes);

// Central error handler — must be registered last.
app.use(errorMiddleware);

export const httpServer = http.createServer(app);
export default app;
