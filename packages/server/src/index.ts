import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import routes
import authRoutes from './routes/auth';
import airtableRoutes from './routes/airtable';
import documentsRoutes from './routes/documents';
import bankStatementRoutes from './routes/bank-statement-processing';
import customerSubscriptionsRoutes from './routes/customer-subscriptions';
import processorBillingRoutes from './routes/processor-billing';
import servicesRoutes from './routes/services';
import servicesCachedRoutes from './routes/services-cached';
import subscriptionsRoutes from './routes/subscriptions';
import youtubeVideosRoutes from './routes/youtube-videos';
import serviceByClientRoutes from './routes/service-by-client';
import companyContactsRoutes from './routes/company-contacts';
import contactsRoutes from './routes/contacts';
import companiesRoutes from './routes/companies';
import viewRoutes from './routes/view';
import syncGdriveRoutes from './routes/sync-gdrive';

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
app.route('/api/subscriptions', subscriptionsRoutes);
app.route('/api/youtube-videos', youtubeVideosRoutes);
app.route('/api/service-by-client', serviceByClientRoutes);
app.route('/api/company-contacts', companyContactsRoutes);
app.route('/api/contacts', contactsRoutes);
app.route('/api/companies', companiesRoutes);
app.route('/api/view', viewRoutes);
app.route('/api/sync-gdrive', syncGdriveRoutes);

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
console.log(`   - POST /api/auth/login`);
console.log(`   - GET  /api/auth/me`);
console.log(`   - POST /api/auth/register`);
console.log(`   - POST /api/auth/refresh`);
console.log(`   - GET  /api/airtable`);
console.log(`   - POST /api/airtable`);
console.log(`   - GET  /api/documents`);
console.log(`   - POST /api/documents`);
console.log(`   - DELETE /api/documents`);
console.log(`   - GET  /api/documents/view`);
console.log(`   - GET  /api/documents/download`);
console.log(`   - GET  /api/documents/generate-code`);
console.log(`   - POST /api/bank-statement-processing`);
console.log(`   - GET  /api/bank-statement-processing/status`);
console.log(`   - GET  /api/bank-statement-processing/download`);
console.log(`   - GET  /api/customer-subscriptions`);
console.log(`   - GET  /api/processor-billing`);
console.log(`   - GET  /api/services`);
console.log(`   - GET  /api/services-cached`);
console.log(`   - DELETE /api/services-cached`);
console.log(`   - POST /api/subscriptions`);
console.log(`   - PATCH /api/subscriptions`);
console.log(`   - DELETE /api/subscriptions`);
console.log(`   - GET  /api/youtube-videos`);
console.log(`   - GET  /api/service-by-client`);
console.log(`   - GET  /api/company-contacts`);
console.log(`   - POST /api/company-contacts`);
console.log(`   - GET  /api/company-contacts/:id`);
console.log(`   - PATCH /api/company-contacts/:id`);
console.log(`   - DELETE /api/company-contacts/:id`);
console.log(`   - GET  /api/company-contacts/contact/:contactId/companies`);
console.log(`   - GET  /api/company-contacts/company/:companyId/contacts`);
console.log(`   - POST /api/company-contacts/contact/:contactId/set-primary`);
console.log(`   - GET  /api/company-contacts/service/:serviceName/subscribers`);
console.log(`   - GET  /api/contacts`);
console.log(`   - GET  /api/contacts/:id`);
console.log(`   - GET  /api/companies`);
console.log(`   - GET  /api/companies/:id`);
console.log(`   - GET  /api/view`);
console.log(`   - GET  /api/sync-gdrive/preview`);
console.log(`   - POST /api/sync-gdrive`);

export default {
  port,
  fetch: app.fetch,
};
