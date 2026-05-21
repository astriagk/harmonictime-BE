import app from "./app";
import { env } from "./shared/config/env";
import logger from "./shared/utils/logger";

app.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT}`);
});
