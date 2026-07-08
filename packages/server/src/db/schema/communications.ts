import { pgTable, text, boolean, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';
import { messageTemplates } from './catalogs';
import { corporations } from './people';

// Airtable "Messages" — email content for both single-send and batch sends.
export const messages = pgTable(
  'messages',
  {
    id: id(),
    emailSubject: text('email_subject'),
    emailContent: text('email_content'),
    isBatchMessage: boolean('is_batch_message').default(false).notNull(),
    batchId: text('batch_id'),
    templateUsedId: text('template_used_id').references(() => messageTemplates.id, { onDelete: 'set null' }),
    variablesUsed: text('variables_used'), // JSON string, parsed by routes
    createdAt: createdAt(),
  },
  (t) => [index('messages_batch_id_idx').on(t.batchId)]
);

// Airtable "Communications Corporate" — junction Message ↔ Corporations, one
// row per recipient. Personalized subject/content are the actual sent text
// (snapshotted so edits to the Message template don't retroactively change
// history). 'Email Subject' / 'Company_Contacts (from Corporate)' / 'To Email'
// were Airtable formula/lookup fields (record title + contact lookups) and
// are not stored — serializers recompute them from the corporation join.
export const communicationsCorporate = pgTable(
  'communications_corporate',
  {
    id: id(),
    messageId: text('message_id').references(() => messages.id, { onDelete: 'set null' }),
    corporationId: text('corporation_id').references(() => corporations.id, { onDelete: 'set null' }),
    status: text('status'),
    description: text('description'),
    batchId: text('batch_id'),
    personalizedSubject: text('personalized_subject'),
    personalizedContent: text('personalized_content'),
    variableValues: text('variable_values'), // JSON string
    createdAt: createdAt(),
  },
  (t) => [
    index('communications_corporate_corporation_idx').on(t.corporationId),
    index('communications_corporate_batch_idx').on(t.batchId),
  ]
);
