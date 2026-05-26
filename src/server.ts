import { httpServer } from "./app";
import { env } from "./shared/config/env";
import logger from "./shared/utils/logger";
import { initChatGateway } from "./modules/chat";

initChatGateway(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT}`);
});
