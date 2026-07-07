import { pgTable, text, integer, boolean, index } from 'drizzle-orm/pg-core';
import { id, createdAt } from './helpers';

// Airtable "Knowledge Categories".
export const knowledgeCategories = pgTable('knowledge_categories', {
  id: id(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  description: text('description'),
  icon: text('icon'),
  color: text('color'),
  sortOrder: integer('sort_order'),
  status: text('status'),
  createdAt: createdAt(),
});

// Airtable "Knowledge Articles". Migrated together with categories (both in
// Phase 1) so category articleCount can be a real SQL count instead of a
// snapshot that drifts. Date fields are text to preserve Airtable's exact
// string values (byte-compatible responses).
export const knowledgeArticles = pgTable(
  'knowledge_articles',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').unique(),
    summary: text('summary'),
    content: text('content'),
    categoryId: text('category_id').references(() => knowledgeCategories.id),
    tags: text('tags').array(),
    status: text('status'),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    viewCount: integer('view_count').default(0).notNull(),
    featured: boolean('featured').default(false).notNull(),
    createdDate: text('created_date'),
    lastModified: text('last_modified'),
    createdAt: createdAt(),
  },
  (t) => [
    index('knowledge_articles_status_category_idx').on(t.status, t.categoryId),
  ]
);
