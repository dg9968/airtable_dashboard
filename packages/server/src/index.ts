// Bun dev entry point. All routes/middleware live in app.ts — register new routes there.
import app from './app';

const port = process.env.PORT || 3001;

console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
