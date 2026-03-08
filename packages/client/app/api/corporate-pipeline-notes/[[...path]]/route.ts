import { createProxyHandlers } from '@/lib/create-proxy-handlers';

export const { GET, POST, PATCH, DELETE } = createProxyHandlers('/api/corporate-pipeline-notes');
