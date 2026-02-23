// Node.js server entry point
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import routes
import authRoutes from './routes/auth';
import airtableRoutes from './routes/airtable';
import documentsRoutes from './routes/documents';
import bankStatementRoutes from './routes/bank-statement-processing';
import csvToQboRoutes from './routes/csv-to-qbo';
import customerSubscriptionsRoutes from './routes/customer-subscriptions';
import processorBillingRoutes from './routes/processor-billing';
import servicesRoutes from './routes/services';
import servicesCachedRoutes from './routes/services-cached';
import servicesPersonalRoutes from './routes/services-personal';
import subscriptionsRoutes from './routes/subscriptions';
import youtubeVideosRoutes from './routes/youtube-videos';
import serviceByClientRoutes from './routes/service-by-client';
import companyContactsRoutes from './routes/company-contacts';
import contactsRoutes from './routes/contacts';
import companiesRoutes from './routes/companies';
import viewRoutes from './routes/view';
import syncGdriveRoutes from './routes/sync-gdrive';
import personalRoutes from './routes/personal';
import subscriptionsPersonalRoutes from './routes/subscriptions-personal';
import subscriptionsCorporateRoutes from './routes/subscriptions-corporate';
import teamsRoutes from './routes/teams';
import ledgerRoutes from './routes/ledger';
import businessStatsRoutes from './routes/business-stats';
import servicesRenderedRoutes from './routes/services-rendered';
import messagesRoutes from './routes/messages';
import communicationsCorporateRoutes from './routes/communications-corporate';
import communicationsWebhookRoutes from './routes/communications-webhook';
import messageTemplatesRoutes from './routes/message-templates';
import communicationsBatchRoutes from './routes/communications-batch';
import pipelineNotesRoutes from './routes/pipeline-notes';
import corporatePipelineNotesRoutes from './routes/corporate-pipeline-notes';
import billingNotesRoutes from './routes/billing-notes';
import knowledgeCategoriesRoutes from './routes/knowledge-categories';
import knowledgeArticlesRoutes from './routes/knowledge-articles';
import docusignEnvelopesRoutes from './routes/docusign-envelopes';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from any localhost port in development
    if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
      return origin;
    }
    // Allow configured CLIENT_URL in production (e.g., https://airtable-dashboard.onrender.com)
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return origin;
    }
    // Allow Render.com preview deployments
    if (origin && origin.match(/^https:\/\/.*\.onrender\.com$/)) {
      return origin;
    }
    // Default fallback
    return process.env.CLIENT_URL || 'http://localhost:3000';
  },
  credentials: true,
  exposeHeaders: ['Content-Disposition'],
}));

// Note: API authentication is handled by individual routes using JWT/session
// No global API key middleware needed since we're using NextAuth on the client

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/airtable', airtableRoutes);
app.route('/api/documents', documentsRoutes);
app.route('/api/bank-statement-processing', bankStatementRoutes);
app.route('/api/csv-to-qbo', csvToQboRoutes);
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
app.route('/api/subscriptions-corporate', subscriptionsCorporateRoutes);
app.route('/api/teams', teamsRoutes);
app.route('/api/ledger', ledgerRoutes);
app.route('/api/business-stats', businessStatsRoutes);
app.route('/api/services-rendered', servicesRenderedRoutes);
app.route('/api/messages', messagesRoutes);
app.route('/api/communications-corporate', communicationsCorporateRoutes);
app.route('/api/communications-webhook', communicationsWebhookRoutes);
app.route('/api/message-templates', messageTemplatesRoutes);
app.route('/api/communications', communicationsBatchRoutes);
app.route('/api/pipeline-notes', pipelineNotesRoutes);
app.route('/api/corporate-pipeline-notes', corporatePipelineNotesRoutes);
app.route('/api/billing-notes', billingNotesRoutes);
app.route('/api/knowledge-categories', knowledgeCategoriesRoutes);
app.route('/api/knowledge-articles', knowledgeArticlesRoutes);
app.route('/api/docusign', docusignEnvelopesRoutes);

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

console.log(`🚀 Server starting on http://0.0.0.0:${port}`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

console.log(`✅ Server running on http://localhost:${port}`);
