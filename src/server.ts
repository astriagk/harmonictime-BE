import { httpServer } from "./app";
import { env } from "./shared/config/env";
import logger from "./shared/utils/logger";
import { initChatGateway } from "./modules/chat";
import { connectDB } from "./shared/config/database";
import { startTrackingSyncJob } from "./shared/jobs/trackingSync.job";

async function bootstrap() {
  await connectDB();
  logger.info("Connected to database");
  startTrackingSyncJob();

  initChatGateway(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server is running on port ${env.PORT}`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${err}`);
  process.exit(1);
});
