# Angular App Deployment — Cloudflare Pages

Best free option for Angular SPAs: unlimited bandwidth, global CDN, 200+ edge locations.

## Prerequisites

- Angular repo pushed to GitHub
- Backend API URL from Railway (e.g. `https://kronosquare-be.up.railway.app`)

## 1. Connect to Cloudflare Pages

1. Sign up / log in at https://pages.cloudflare.com
2. Click **Create a project** → **Connect to Git**
3. Authorize GitHub and select your Angular repository
4. Click **Begin setup**

## 2. Build Configuration

| Setting | Value |
|---|---|
| Framework preset | Angular |
| Build command | `npm run build -- --configuration production` |
| Build output directory | `dist/<your-app-name>/browser` |
| Root directory | `/` (leave default) |
| Node.js version | `18` |

> Find your app name in `angular.json` under `projects` → the key is your app name.
> Example output path: `dist/krono-square/browser`

## 3. Environment Variables

Add these in the Cloudflare Pages build settings:

```
NODE_VERSION=18
```

For Angular environment files, update `src/environments/environment.prod.ts` in your Angular repo to point to the production API:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://kronosquare-be.up.railway.app',
  socketUrl: 'https://kronosquare-be.up.railway.app',
};
```

Commit and push this change before deploying.

## 4. Deploy

Click **Save and Deploy** — Cloudflare builds and deploys automatically.

On success you get a URL like: `https://krono-square.pages.dev`

## 5. Custom Domain (Free)

If you have a domain registered through Cloudflare (or transfer DNS to Cloudflare):

1. Go to your Pages project → **Custom domains**
2. Click **Set up a custom domain**
3. Enter `www.kronosquare.in` (or your domain)
4. Follow the DNS instructions
5. SSL/TLS is automatic and free

If your domain is at Namecheap/GoDaddy, add a CNAME record:
```
Type:  CNAME
Name:  www
Value: krono-square.pages.dev
```

## 6. Auto-deploys on Push

Every `git push` to your main branch triggers a new build automatically.
Preview deployments are created for every pull request.

## Free Tier Limits

| Limit | Value |
|---|---|
| Bandwidth | Unlimited |
| Builds per month | 500 |
| Build time per month | 500 minutes |
| Sites | Unlimited |

These limits are effectively unlimited for an early-stage app.
