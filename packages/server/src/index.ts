import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import routes
import airtableRoutes from './routes/airtable';
import documentsRoutes from './routes/documents';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/airtable', airtableRoutes);
app.route('/api/documents', documentsRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

const port = process.env.PORT || 3001;

console.log(`🚀 Server running on http://localhost:${port}`);
console.log(`📚 API routes available:`);
console.log(`   - GET  /health`);
console.log(`   - GET  /api/airtable`);
console.log(`   - POST /api/airtable`);
console.log(`   - GET  /api/documents`);
console.log(`   - POST /api/documents`);
console.log(`   - DELETE /api/documents`);
console.log(`   - GET  /api/documents/generate-code`);

export default {
  port,
  fetch: app.fetch,
};
