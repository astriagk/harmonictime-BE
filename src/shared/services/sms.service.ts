import { Twilio } from "twilio";
import { env } from "../config/env";

// Lazy singleton — created on first use so the env is fully resolved by then
let _client: Twilio | null = null;
const getClient = (): Twilio => {
  if (!_client) _client = new Twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return _client;
};

export const sendSMS = async (to: string, body: string): Promise<void> => {
  await getClient().messages.create({
    body,
    from: env.TWILIO_PHONE_NUMBER,
    to,
  });
};

// Twilio Verify — sends a one-time OTP to the given E.164 phone number
export const sendMobileOTP = async (to: string): Promise<void> => {
  await getClient()
    .verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID)
    .verifications.create({ to, channel: "sms" });
};

// Returns true when the code matches and the verification is approved
export const verifyMobileOTP = async (
  to: string,
  code: string,
): Promise<boolean> => {
  const check = await getClient()
    .verify.v2.services(env.TWILIO_VERIFY_SERVICE_SID)
    .verificationChecks.create({ to, code });
  return check.status === "approved";
};
