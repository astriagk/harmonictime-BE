# MongoDB Atlas — Account Setup Guide

Used for: primary database — all users, products, orders, payments, wallets, chats.  
**Free tier (M0) available.** Enough for development and early production.

---

## Step 1 — Create a MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Sign up with your Google account or email
3. Verify your email if prompted
4. On the welcome screen, choose **"I'm learning MongoDB"** or **"Build a new app"** (doesn't matter)

---

## Step 2 — Create a Free Cluster

1. Click **"Create a cluster"**
2. Select **M0 Free** (the default free option)
3. Choose a cloud provider and region — pick one close to your users (e.g. **AWS → Mumbai ap-south-1** for India)
4. Give the cluster a name (e.g. `development`)
5. Click **"Create Deployment"**

Atlas takes ~2 minutes to provision the cluster.

---

## Step 3 — Create a Database User

1. In the left sidebar go to **Security → Database Access**
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a username (e.g. `astriagk_db`) and a strong password
5. Under "Database User Privileges" select **"Atlas admin"** (or "Read and write to any database" for slightly less access)
6. Click **"Add User"**

> Save the username and password — you'll need them for the connection string.

---

## Step 4 — Whitelist Your IP Address

1. In the left sidebar go to **Security → Network Access**
2. Click **"Add IP Address"**
3. For development: click **"Allow Access from Anywhere"** → adds `0.0.0.0/0`
4. For production: add only your server's specific IP address
5. Click **"Confirm"**

---

## Step 5 — Get the Connection String

1. On the cluster overview page click **"Connect"**
2. Choose **"Drivers"**
3. Select **Driver: Node.js**, **Version: 5.5 or later**
4. Copy the connection string — it looks like:

```
mongodb+srv://<username>:<password>@<cluster-name>.xxxxx.mongodb.net/?appName=<cluster-name>
```

5. Replace `<username>` and `<password>` with the credentials from Step 3

---

## Step 6 — Set Environment Variables

Add these to your `.env` file:

```env
MONGO_URI=mongodb+srv://your_username:your_password@your-cluster.xxxxx.mongodb.net/?appName=development
DB_NAME=harmonictime-dev
```

- `MONGO_URI` — full connection string from Step 5 (include username + password)
- `DB_NAME` — the database name Atlas will create automatically on first write

> Use `harmonictime-dev` for development and `harmonictime-prod` for production. Atlas creates the DB automatically — no manual creation needed.

---

## Step 7 — Test the Connection

Start the server:

```bash
npm run dev
```

You should see in the logs:

```
Database connected successfully
```

If you see a connection error, check:
- Username and password are correct in `MONGO_URI`
- Your current IP is whitelisted in Network Access
- The cluster is in the "Active" state in Atlas (not paused)

---

## Free Tier Limits (M0)

| Feature | M0 Free |
|---------|---------|
| Storage | 512 MB |
| RAM | Shared |
| Connections | 500 max |
| Backups | No automated backups |
| Region | 1 region only |

M0 is paused automatically after 60 days of inactivity. You'll get an email from Atlas — just log in and resume it.

---

## Upgrading to Paid (when needed)

When you hit storage or connection limits:
1. Go to your cluster → **"..."** menu → **"Edit Configuration"**
2. Select **M10** ($57/month) — the first paid tier with dedicated RAM and automated backups
3. No data loss or connection string change required

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Authentication failed` | Wrong username/password in `MONGO_URI` |
| `Connection timed out` | Your IP isn't whitelisted in Network Access |
| `ServerSelectionTimeoutError` | Cluster is paused (free tier); resume it in Atlas |
| `Database not initialised` error in logs | `connectDB()` wasn't called before the first DB access — check `src/server.ts` |
| Data visible in Atlas but not in app | `DB_NAME` in `.env` doesn't match the actual database name in Atlas |

---

## Files in This Project

| File | Purpose |
|------|---------|
| `src/shared/config/database.ts` | `connectDB()` and `getDB()` — MongoDB client singleton |
| `src/shared/config/env.ts` | `MONGO_URI` and `DB_NAME` env var definitions |
| `src/shared/repositories/base.repository.ts` | Base class for all MongoDB collections |
