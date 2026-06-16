import { EmailTemplate } from "./types";
import { layout } from "./layout";
import { env } from "../config/env";

// Sent right after an account is created.
export const welcomeEmail = (): EmailTemplate => ({
  subject: `Welcome to ${env.BRAND_NAME}`,
  text: "Your account has been created successfully. Welcome aboard!",
  html: layout(`
    <h2 style="margin:0 0 16px;">Welcome aboard! 🎉</h2>
    <p style="margin:0 0 12px;">Your ${env.BRAND_NAME} account has been created successfully.</p>
    <p style="margin:0;">You can now sign in and start exploring our collection.</p>
  `),
});
