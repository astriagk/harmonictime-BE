# MongoDB Atlas — Setup Guide

Free M0 cluster on AWS Mumbai (ap-south-1) — closest region to Indian users.

## 1. Create a Free Cluster

1. Sign up / log in at https://cloud.mongodb.com
2. Click **Create a deployment** → select **M0 Free**
3. Cloud provider: **AWS**, Region: **ap-south-1 (Mumbai)**
4. Name your cluster (e.g. `krono-square-prod`)
5. Click **Create**

## 2. Create a Database User

1. Go to **Database Access** (left sidebar)
2. Click **Add New Database User**
3. Authentication: **Password**
4. Username: `kronosquare_api`
5. Password: generate a strong random password — save it
6. Database User Privileges: **Read and write to any database**
7. Click **Add User**

## 3. Allow Network Access

1. Go to **Network Access** (left sidebar)
2. Click **Add IP Address**
3. For now: click **Allow Access from Anywhere** (`0.0.0.0/0`)

> Once Railway gives you a static IP (Railway Pro), replace `0.0.0.0/0` with that IP for better security.

## 4. Get the Connection String

1. Go to **Database** → click **Connect** on your cluster
2. Select **Drivers** → Driver: Node.js
3. Copy the connection string — it looks like:
   ```
   mongodb+srv://kronosquare_api:<password>@krono-square-prod.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<password>` with the password you created
5. Add your database name at the end:
   ```
   mongodb+srv://kronosquare_api:<password>@krono-square-prod.xxxxx.mongodb.net/kronosquare?retryWrites=true&w=majority
   ```

Set this as your `MONGO_URI` environment variable in Railway.

## 5. Seed Reference Data

After the backend is deployed and connected, run the seed script once:

```bash
npm run seed:reference
```

## Free Tier Limits

| Limit | M0 Value |
|---|---|
| Storage | 512 MB |
| Max connections | 500 (shared) |
| RAM | Shared |
| Backups | No automated backups |

## When to Upgrade

Upgrade to **M2 ($9/mo)** when:
- Storage approaches 400MB
- You need automated backups
- You see connection timeout errors under load

Upgrade to **M10 ($57/mo)** when you need dedicated resources (typically 1,000+ daily active users).
