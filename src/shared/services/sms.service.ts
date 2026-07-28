import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { env } from "../config/env";
import logger from "../utils/logger";

// SMS is sent via Amazon SNS. Reuses the AWS STORAGE_* credentials (same IAM
// user as S3 and SES); the user must have the sns:Publish permission.
//
// India note: local (DLT) routes only work from ap-south-1 / ap-south-2, so
// SMS_REGION is deliberately separate from SES_REGION. Sending from us-east-1
// silently falls back to the international route — pricier and heavily filtered
// by Indian carriers. See docs/accounts/aws/sns-sms.md.
const sns = new SNSClient({
  region: env.SMS_REGION,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
});

// Without the DLT registration SMS still sends, but falls back to the
// international route: unregistered sender, less reliable delivery. Fine for
// sandbox testing, not for production traffic to India.
if (!env.SMS_SENDER_ID || !env.SMS_DLT_ENTITY_ID) {
  logger.warn(
    `SMS: DLT not configured (${!env.SMS_SENDER_ID ? "SMS_SENDER_ID" : "SMS_DLT_ENTITY_ID"} unset) — ` +
      "sending on the international route. Expected during setup; complete Part B of " +
      "docs/accounts/aws/sns-sms.md before production.",
  );
}

type Attr = { DataType: string; StringValue: string };

// SenderID and SMSType are always sent. The DLT pair is required only for
// Indian numbers, but harmless elsewhere — omitted when unconfigured so
// non-India deployments work without a TRAI registration.
const buildAttributes = (templateId: string): Record<string, Attr> => {
  const attrs: Record<string, Attr> = {
    "AWS.SNS.SMS.SMSType": {
      DataType: "String",
      StringValue: "Transactional",
    },
  };
  if (env.SMS_SENDER_ID)
    attrs["AWS.SNS.SMS.SenderID"] = {
      DataType: "String",
      StringValue: env.SMS_SENDER_ID,
    };
  if (env.SMS_DLT_ENTITY_ID)
    attrs["AWS.MM.SMS.EntityId"] = {
      DataType: "String",
      StringValue: env.SMS_DLT_ENTITY_ID,
    };
  if (templateId)
    attrs["AWS.MM.SMS.TemplateId"] = {
      DataType: "String",
      StringValue: templateId,
    };
  return attrs;
};

// Publish a message to an E.164 phone number.
//
// templateId must be the DLT template registered for this exact message shape —
// carriers drop messages whose body doesn't match their registered template
// byte for byte, so the builders below are the only intended callers.
export const sendSMS = async (
  to: string,
  body: string,
  templateId = "",
): Promise<void> => {
  await sns.send(
    new PublishCommand({
      PhoneNumber: to,
      Message: body,
      MessageAttributes: buildAttributes(templateId),
    }),
  );
};

// --- Message builders -------------------------------------------------------
// Each string must match its registered DLT template exactly: same wording,
// spacing, punctuation and capitalisation. Editing these without re-registering
// the template on the DLT portal will cause silent delivery failures in India.

const otpMessage = (otp: string): string =>
  `${otp} is your ${env.BRAND_NAME} verification code. It is valid for 10 minutes. Do not share this code with anyone.`;

const passwordResetMessage = (otp: string, url: string): string =>
  `${otp} is your ${env.BRAND_NAME} password reset code. It is valid for 10 minutes. Reset here: ${url}`;

// Phone-number verification OTP.
export const sendMobileOTP = (to: string, otp: string): Promise<void> =>
  sendSMS(to, otpMessage(otp), env.SMS_DLT_TEMPLATE_ID_OTP);

// Password-reset OTP with the reset link.
export const sendPasswordResetSMS = (
  to: string,
  otp: string,
  url: string,
): Promise<void> =>
  sendSMS(to, passwordResetMessage(otp, url), env.SMS_DLT_TEMPLATE_ID_RESET);
