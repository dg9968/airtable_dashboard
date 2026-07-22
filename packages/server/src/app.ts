// Shared Hono app used by both entry points (index.ts for Bun dev, node-server.ts for prod).
// Register new routes HERE ONLY — never in the entry points.
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import routes
import documentsRoutes from './routes/documents';
import bankStatementRoutes from './routes/bank-statement-processing';
import csvToQboRoutes from './routes/csv-to-qbo';
import processorBillingRoutes from './routes/processor-billing';
import servicesRoutes from './routes/services';
import servicesCachedRoutes from './routes/services-cached';
import servicesPersonalRoutes from './routes/services-personal';
import corporateBillingBundlesRoutes from './routes/corporate-billing-bundles';
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
import extensionsRoutes from './routes/extensions';
import extensionsPersonalRoutes from './routes/extensions-personal';
import taxNoticesRoutes from './routes/tax-notices';
import taxNoticeNotesRoutes from './routes/tax-notice-notes';
import taxNoticeAttachmentsRoutes from './routes/tax-notice-attachments';
import healthDbRoutes from './routes/health-db';
import teamDirectoryRoutes from './routes/team-directory';
import openTicketsDashboardRoutes from './routes/open-tickets-dashboard';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => {
    // Allow requests from any localhost port in development
    if (origin && origin.match(/^http:\/\/localhost:\d+$/)) {
      return origin;
    }
    // Allow local network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
    if (origin && origin.match(/^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/)) {
      return origin;
    }
    // Allow any .onrender.com domain (incl. preview deployments)
    if (origin && origin.match(/^https:\/\/.*\.onrender\.com$/)) {
      return origin;
    }
    // Allow configured CLIENT_URL in production
    if (process.env.CLIENT_URL && origin === process.env.CLIENT_URL) {
      return origin;
    }
    // Default fallback
    return process.env.CLIENT_URL || 'http://localhost:3000';
  },
  credentials: true,
  exposeHeaders: ['Content-Disposition'],
}));

// Health check (no auth required)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.route('/api/health', healthDbRoutes);
app.route('/api/documents', documentsRoutes);
app.route('/api/bank-statement-processing', bankStatementRoutes);
app.route('/api/csv-to-qbo', csvToQboRoutes);
app.route('/api/processor-billing', processorBillingRoutes);
app.route('/api/services', servicesRoutes);
app.route('/api/services-cached', servicesCachedRoutes);
app.route('/api/services-personal', servicesPersonalRoutes);
app.route('/api/corporate-billing-bundles', corporateBillingBundlesRoutes);
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
app.route('/api/team-directory', teamDirectoryRoutes);
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
app.route('/api/extensions', extensionsRoutes);
app.route('/api/extensions-personal', extensionsPersonalRoutes);
app.route('/api/tax-notices', taxNoticesRoutes);
app.route('/api/tax-notice-notes', taxNoticeNotesRoutes);
app.route('/api/tax-notice-attachments', taxNoticeAttachmentsRoutes);
app.route('/api/open-tickets-dashboard', openTicketsDashboardRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found', path: c.req.path }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: 'Internal Server Error', message: err.message }, 500);
});

export default app;
