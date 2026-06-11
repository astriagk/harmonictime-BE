# Email Setup — Brevo SMTP

Gmail limits you to 500 emails/day and can suspend your account for bulk sends.
Brevo (formerly Sendinblue) gives 300 transactional emails/day free — right for early stage.

## 1. Create Brevo Account

1. Sign up at https://brevo.com
2. Verify your email
3. Complete the onboarding (company name: Krono Square, use case: transactional emails)

## 2. Get SMTP Credentials

1. Go to **SMTP & API** (top navigation)
2. Click **SMTP** tab
3. You will see:
   ```
   SMTP Server:  smtp-relay.brevo.com
   Port:         587
   Login:        your-brevo-login@email.com
   Password:     <your SMTP key>
   ```
4. If no SMTP key exists, click **Generate a new SMTP key**

## 3. Update Environment Variables

In Railway, update these two variables:

```
EMAIL_USER=your-brevo-login@email.com
EMAIL_PASS=<brevo-smtp-key>
```

Your `nodemailer` config in the backend should use:
```typescript
{
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  }
}
```

## 4. Verify a Sender Domain (Recommended)

To avoid emails landing in spam, verify your domain:

1. In Brevo → **Senders & IP** → **Domains**
2. Add your domain (e.g. `kronosquare.in`)
3. Brevo gives you DNS records to add at your registrar:
   ```
   TXT  @   v=spf1 include:spf.brevo.com ~all
   TXT  brevo._domainkey   <dkim-value>
   ```
4. Once verified, use `noreply@kronosquare.in` as your sender address

## Free Tier Limits

| Limit | Value |
|---|---|
| Emails/day | 300 |
| Emails/month | 9,000 |
| SMTP | Included |
| Email templates | Included |

## When to Upgrade

Upgrade to Brevo Starter ($25/mo) when you consistently send > 300 emails/day.
Alternatively, Resend.com free plan gives 3,000/month (100/day) and has a cleaner API.
