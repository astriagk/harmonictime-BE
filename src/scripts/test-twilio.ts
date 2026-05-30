import dotenv from "dotenv";
import path from "path";
import twilio from "twilio";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const accountSid = process.env.TWILIO_ACCOUNT_SID ?? "";
const authToken = process.env.TWILIO_AUTH_TOKEN ?? "";
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID ?? "";

console.log("TWILIO_ACCOUNT_SID :", accountSid ? `${accountSid.slice(0, 6)}...` : "MISSING");
console.log("TWILIO_AUTH_TOKEN  :", authToken  ? `${authToken.slice(0, 6)}...`  : "MISSING");
console.log("TWILIO_VERIFY_SID  :", verifySid  ? `${verifySid.slice(0, 6)}...`  : "MISSING");

if (!accountSid || !authToken || !verifySid) {
  console.error("\nOne or more env vars are missing. Check your .env file.");
  process.exit(1);
}

async function main() {
  const client = twilio(accountSid, authToken);
  const testPhone = process.argv[2];

  if (!testPhone) {
    console.log("\nCredentials loaded OK. To send a test OTP run:");
    console.log("  npx ts-node src/scripts/test-twilio.ts +919876543210");
    return;
  }

  console.log(`\nSending OTP to ${testPhone}...`);
  try {
    const v = await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: testPhone, channel: "sms" });
    console.log("Status:", v.status);
  } catch (err: any) {
    console.error("Twilio error:", err.message);
    console.error("Code:", err.code, "| HTTP status:", err.status);
  }
}

main();
