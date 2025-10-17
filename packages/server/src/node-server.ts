// Node.js server entry point
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import routes
import authRoutes from './routes/auth.js';
import airtableRoutes from './routes/airtable.js';
import documentsRoutes from './routes/documents.js';
import bankStatementRoutes from './routes/bank-statement-processing.js';
import customerSubscriptionsRoutes from './routes/customer-subscriptions.js';
import processorBillingRoutes from './routes/processor-billing.js';
import servicesRoutes from './routes/services.js';
import servicesCachedRoutes from './routes/services-cached.js';
import servicesPersonalRoutes from './routes/services-personal.js';
import subscriptionsRoutes from './routes/subscriptions.js';
import youtubeVideosRoutes from './routes/youtube-videos.js';
import serviceByClientRoutes from './routes/service-by-client.js';
import companyContactsRoutes from './routes/company-contacts.js';
import contactsRoutes from './routes/contacts.js';
import companiesRoutes from './routes/companies.js';
import viewRoutes from './routes/view.js';
import syncGdriveRoutes from './routes/sync-gdrive.js';
import personalRoutes from './routes/personal.js';
import subscriptionsPersonalRoutes from './routes/subscriptions-personal.js';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from any localhost port in development
    if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
      return origin;
    }
    // Allow configured CLIENT_URL in production
    return process.env.CLIENT_URL || 'http://localhost:3000';
  },
  credentials: true,
}));

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/airtable', airtableRoutes);
app.route('/api/documents', documentsRoutes);
app.route('/api/bank-statement-processing', bankStatementRoutes);
app.route('/api/customer-subscriptions', customerSubscriptionsRoutes);
app.route('/api/processor-billing', processorBillingRoutes);
app.route('/api/services', servicesRoutes);
app.route('/api/services-cached', servicesCachedRoutes);
app.route('/api/services-personal', servicesPersonalRoutes);
app.route('/api/subscriptions', subscriptionsRoutes);
app.route('/api/youtube-videos', youtubeVideosRoutes);
app.route('/api/service-by-client', serviceByClientRoutes);
app.route('/api/company-contacts', companyContactsRoutes);
app.route('/api/contacts', contactsRoutes);
app.route('/api/companies', companiesRoutes);
app.route('/api/view', viewRoutes);
app.route('/api/sync-gdrive', syncGdriveRoutes);
app.route('/api/personal', personalRoutes);
app.route('/api/subscriptions-personal', subscriptionsPersonalRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

const port = Number(process.env.PORT) || 3001;

console.log(`🚀 Server starting on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`✅ Server running on http://localhost:${port}`);
