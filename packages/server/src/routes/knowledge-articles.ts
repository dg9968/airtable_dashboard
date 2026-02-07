/**
 * Knowledge Articles API Routes
 * CRUD operations for knowledge base articles
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, getRecord } from '../lib/airtable-helpers.js';

const app = new Hono();

const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const ARTICLES_TABLE = 'Knowledge Articles';

// Helper to map Airtable record to article response
function mapRecordToArticle(record: any) {
  return {
    id: record.id,
    title: record.fields['Title'] || '',
    slug: record.fields['Slug'] || '',
    summary: record.fields['Summary'] || '',
    content: record.fields['Content'] || '',
    categoryId: Array.isArray(record.fields['Category']) ? record.fields['Category'][0] : record.fields['Category'] || null,
    tags: record.fields['Tags'] || [],
    status: record.fields['Status'] || 'Draft',
    authorName: record.fields['Author Name'] || '',
    authorEmail: record.fields['Author Email'] || '',
    viewCount: record.fields['View Count'] || 0,
    featured: record.fields['Featured'] || false,
    createdDate: record.fields['Created Date'] || record.createdTime || '',
    lastModified: record.fields['Last Modified'] || '',
  };
}

/**
 * GET /api/knowledge-articles
 * List all knowledge articles with optional filters
 *
 * Query params:
 * - search: Search in title, summary, and content
 * - category: Filter by category ID
 * - status: Filter by status (Draft, Published, Archived)
 * - tags: Filter by tags (comma-separated)
 * - featured: Filter featured articles only
 */
app.get('/', async (c) => {
  try {
    const { search, category, status, tags, featured } = c.req.query();

    const filters: string[] = [];

    // status=all shows all statuses (for admin/staff)
    // status=Published/Draft/Archived filters to that status
    // no status defaults to Published only
    if (status && status !== 'all') {
      filters.push(`{Status} = '${status}'`);
    } else if (!status) {
      filters.push(`{Status} = 'Published'`);
    }
    // If status === 'all', no status filter is added

    if (category) {
      filters.push(`FIND('${category}', ARRAYJOIN({Category}))`);
    }

    if (featured === 'true') {
      filters.push(`{Featured} = TRUE()`);
    }

    if (search) {
      filters.push(
        `OR(` +
        `FIND(LOWER('${search}'), LOWER({Title})), ` +
        `FIND(LOWER('${search}'), LOWER({Summary})), ` +
        `FIND(LOWER('${search}'), LOWER({Content}))` +
        `)`
      );
    }

    // Tags filtering - if multiple tags, article must have at least one
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      const tagFilters = tagList.map(tag => `FIND('${tag}', ARRAYJOIN({Tags}))`);
      if (tagFilters.length > 0) {
        filters.push(`OR(${tagFilters.join(', ')})`);
      }
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    const records = await fetchAllRecords(BASE_ID, ARTICLES_TABLE, {
      filterByFormula,
      sort: [{ field: 'Created Date', direction: 'desc' }],
    });

    const articles = records.map(mapRecordToArticle);

    return c.json({
      success: true,
      data: articles,
      count: articles.length,
    });
  } catch (error) {
    console.error('Error fetching knowledge articles:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotAuthorized = errorMessage.includes('NOT_AUTHORIZED') || errorMessage.includes('Could not find table');

    if (isNotAuthorized) {
      return c.json({
        success: true,
        data: [],
        count: 0,
        setupRequired: true,
        message: 'Knowledge Articles table not found. Please create it in Airtable.',
      });
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
      },
      500
    );
  }
});

/**
 * GET /api/knowledge-articles/slug/:slug
 * Get a single article by its slug
 */
app.get('/slug/:slug', async (c) => {
  try {
    const { slug } = c.req.param();

    const records = await fetchAllRecords(BASE_ID, ARTICLES_TABLE, {
      filterByFormula: `{Slug} = '${slug}'`,
      maxRecords: 1,
    });

    if (records.length === 0) {
      return c.json(
        {
          success: false,
          error: 'Article not found',
        },
        404
      );
    }

    const article = mapRecordToArticle(records[0]);

    return c.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching knowledge article by slug:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch article',
      },
      500
    );
  }
});

/**
 * GET /api/knowledge-articles/:id
 * Get a single article by ID
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    // Skip if it looks like a slug route
    if (id === 'slug') {
      return c.json({ success: false, error: 'Invalid ID' }, 400);
    }

    const record = await getRecord(BASE_ID, ARTICLES_TABLE, id);
    const article = mapRecordToArticle(record);

    return c.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error fetching knowledge article:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch article',
      },
      500
    );
  }
});

/**
 * POST /api/knowledge-articles
 * Create a new article
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();

    const { title, summary, content, categoryId, tags, status, authorName, authorEmail, featured } = body;

    if (!title) {
      return c.json(
        {
          success: false,
          error: 'Article title is required',
        },
        400
      );
    }

    // Generate slug from title
    const baseSlug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Add timestamp to ensure uniqueness
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const fields: Record<string, any> = {
      'Title': title,
      'Slug': slug,
      'Status': status || 'Draft',
    };

    if (summary) fields['Summary'] = summary;
    if (content) fields['Content'] = content;
    if (categoryId) fields['Category'] = [categoryId];
    if (tags && Array.isArray(tags)) fields['Tags'] = tags;
    if (authorName) fields['Author Name'] = authorName;
    if (authorEmail) fields['Author Email'] = authorEmail;
    if (featured !== undefined) fields['Featured'] = featured;
    fields['View Count'] = 0;

    const createdRecords = await createRecords(BASE_ID, ARTICLES_TABLE, [{ fields }]);

    const article = mapRecordToArticle(createdRecords[0]);

    return c.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error creating knowledge article:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create article',
      },
      500
    );
  }
});

/**
 * PATCH /api/knowledge-articles/:id
 * Update an existing article
 */
app.patch('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const fields: Record<string, any> = {};

    if (body.title) {
      fields['Title'] = body.title;
      // Regenerate slug if title changes
      const baseSlug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      fields['Slug'] = `${baseSlug}-${Date.now().toString(36)}`;
    }
    if (body.summary !== undefined) fields['Summary'] = body.summary;
    if (body.content !== undefined) fields['Content'] = body.content;
    if (body.categoryId) fields['Category'] = [body.categoryId];
    if (body.tags !== undefined) fields['Tags'] = body.tags;
    if (body.status) fields['Status'] = body.status;
    if (body.authorName) fields['Author Name'] = body.authorName;
    if (body.authorEmail) fields['Author Email'] = body.authorEmail;
    if (body.featured !== undefined) fields['Featured'] = body.featured;

    const updatedRecords = await updateRecords(BASE_ID, ARTICLES_TABLE, [
      { id, fields },
    ]);

    const article = mapRecordToArticle(updatedRecords[0]);

    return c.json({
      success: true,
      data: article,
    });
  } catch (error) {
    console.error('Error updating knowledge article:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update article',
      },
      500
    );
  }
});

/**
 * DELETE /api/knowledge-articles/:id
 * Archive an article (soft delete)
 */
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    await updateRecords(BASE_ID, ARTICLES_TABLE, [
      {
        id,
        fields: { Status: 'Archived' },
      },
    ]);

    return c.json({
      success: true,
      message: 'Article archived successfully',
    });
  } catch (error) {
    console.error('Error archiving knowledge article:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive article',
      },
      500
    );
  }
});

/**
 * POST /api/knowledge-articles/:id/view
 * Increment view count for an article
 */
app.post('/:id/view', async (c) => {
  try {
    const { id } = c.req.param();

    // Get current view count
    const record = await getRecord(BASE_ID, ARTICLES_TABLE, id);
    const currentViewCount = record.fields['View Count'] || 0;

    // Increment view count
    await updateRecords(BASE_ID, ARTICLES_TABLE, [
      {
        id,
        fields: { 'View Count': currentViewCount + 1 },
      },
    ]);

    return c.json({
      success: true,
      viewCount: currentViewCount + 1,
    });
  } catch (error) {
    console.error('Error incrementing view count:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to increment view count',
      },
      500
    );
  }
});

export default app;
