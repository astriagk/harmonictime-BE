import { Twilio } from "twilio";
import { env } from "../config/env";

const client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export const sendSMS = async (to: string, body: string): Promise<void> => {
  await client.messages.create({
    body,
    from: env.TWILIO_PHONE_NUMBER,
    to,
  });
};
