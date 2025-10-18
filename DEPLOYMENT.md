# Deployment Guide for Render

This application uses a **two-service architecture** on Render:
1. **Hono API Server** - Backend API
2. **Next.js Client** - Frontend web app

## Step 1: Deploy Hono API Server

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Use these settings:
   - **Name**: `vault-api`
   - **Root Directory**: Leave blank (will use render-server.yaml)
   - **Environment**: `Node`
   - **Build Command**: `cd packages/server && npm install && npm run build`
   - **Start Command**: `cd packages/server && npm start`
   - **Plan**: Free

5. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   CLIENT_URL=https://airtable-dashboard.onrender.com
   AIRTABLE_PERSONAL_ACCESS_TOKEN=<your-token>
   AIRTABLE_BASE_ID=<your-base-id>
   AIRTABLE_USERS_TABLE=Users
   AWS_ACCESS_KEY_ID=<your-key>
   AWS_SECRET_ACCESS_KEY=<your-secret>
   AWS_REGION=<your-region>
   AWS_S3_BUCKET=<your-bucket>
   GOOGLE_DRIVE_CREDENTIALS_JSON=<your-credentials>
   GOOGLE_DRIVE_FOLDER_ID=<your-folder-id>
   ```

6. Click **"Create Web Service"**
7. Wait for deployment to complete
8. **Copy the service URL** (e.g., `https://vault-api.onrender.com`)

## Step 2: Deploy Next.js Client

Your existing Render service should already be configured for the client using `render.yaml`.

1. Go to your existing `airtable-dashboard` service in Render
2. Go to **Environment** tab
3. Add/Update the `HONO_API_URL` environment variable:
   ```
   HONO_API_URL=https://vault-api.onrender.com
   ```
   (Use the URL from Step 1)

4. The service will automatically redeploy with the new environment variable

## Step 3: Verify Deployment

1. Visit your Next.js app: `https://airtable-dashboard.onrender.com`
2. Check that API calls work (sign in, view data, etc.)
3. Check Hono API health: `https://vault-api.onrender.com/health`

## Alternative: Manual Service Creation

If you prefer to create the services manually instead of using YAML:

### For Hono API:
- **Root Directory**: `packages/server`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/health`

### For Next.js Client:
- **Root Directory**: `packages/client`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Health Check Path**: `/`

## Troubleshooting

### API calls fail with CORS errors
- Make sure `CLIENT_URL` in the Hono server matches your Next.js URL exactly
- Check that CORS is enabled in `packages/server/src/node-server.ts`

### Build fails on Hono server
- Verify all environment variables are set
- Check that `@hono/node-server` is in dependencies
- Make sure `type: "module"` is in `packages/server/package.json`

### Next.js can't connect to API
- Verify `HONO_API_URL` is set correctly in Next.js environment
- Check that the Hono server is running (visit `/health` endpoint)
- Ensure the Hono server URL is HTTPS (not HTTP)

## Free Tier Limitations

Render free tier services:
- Sleep after 15 minutes of inactivity
- May take 30-60 seconds for first request to wake up
- Consider upgrading to paid tier for production use
