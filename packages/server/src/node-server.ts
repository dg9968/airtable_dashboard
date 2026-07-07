// Node.js production entry point (Render.com). All routes/middleware live in app.ts —
// register new routes there.
import { serve } from '@hono/node-server';
import app from './app';

const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Server starting on http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`✅ Server running on http://localhost:${port}`);
