// Central registry of email templates. Add new templates here so callers can
// import them from one place:  import { welcomeEmail } from "shared/email-templates";
//
// To add a template: create `<name>.template.ts` exporting a function that
// returns an EmailTemplate, then re-export it below. Send it with
// sendTemplateEmail(to, theTemplate(...)).
export * from "./types";
export * from "./welcome.template";
export * from "./passwordResetOtp.template";
export * from "./contactNotification.template";
export * from "./accountStatus.template";
export * from "./withdrawal.template";
