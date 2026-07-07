/**
 * Knowledge Articles API Routes (Postgres-backed)
 * CRUD operations for knowledge base articles
 */

import { Hono } from 'hono';
import { and, arrayOverlaps, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { knowledgeArticles } from '../db/schema';

const app = new Hono();

type ArticleRow = typeof knowledgeArticles.$inferSelect;

function mapRowToArticle(row: ArticleRow) {
  return {
    id: row.id,
    title: row.title || '',
    slug: row.slug || '',
    summary: row.summary || '',
    content: row.content || '',
    categoryId: row.categoryId || null,
    tags: row.tags || [],
    status: row.status || 'Draft',
    authorName: row.authorName || '',
    authorEmail: row.authorEmail || '',
    viewCount: row.viewCount || 0,
    featured: row.featured || false,
    createdDate: row.createdDate || row.createdAt.toISOString() || '',
    lastModified: row.lastModified || '',
  };
}

function slugify(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  // Add timestamp to ensure uniqueness
  return `${baseSlug}-${Date.now().toString(36)}`;
}

/**
 * GET /api/knowledge-articles
 * List all knowledge articles with optional filters
 *
 * Query params:
 * - search: Search in title, summary, and content
 * - category: Filter by category ID
 * - status: Filter by status (Draft, Published, Archived), or 'all'
 * - tags: Filter by tags (comma-separated, article must have at least one)
 * - featured: Filter featured articles only
 */
app.get('/', async (c) => {
  try {
    const { search, category, status, tags, featured } = c.req.query();

    const conditions = [];

    // status=all shows all statuses (for admin/staff); no status defaults to Published
    if (status && status !== 'all') {
      conditions.push(eq(knowledgeArticles.status, status));
    } else if (!status) {
      conditions.push(eq(knowledgeArticles.status, 'Published'));
    }

    if (category) {
      conditions.push(eq(knowledgeArticles.categoryId, category));
    }

    if (featured === 'true') {
      conditions.push(eq(knowledgeArticles.featured, true));
    }

    if (search) {
      conditions.push(
        or(
          ilike(knowledgeArticles.title, `%${search}%`),
          ilike(knowledgeArticles.summary, `%${search}%`),
          ilike(knowledgeArticles.content, `%${search}%`)
        )
      );
    }

    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      if (tagList.length > 0) {
        conditions.push(arrayOverlaps(knowledgeArticles.tags, tagList));
      }
    }

    const rows = await getDb()
      .select()
      .from(knowledgeArticles)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(knowledgeArticles.createdDate));

    const articles = rows.map(mapRowToArticle);

    return c.json({
      success: true,
      data: articles,
      count: articles.length,
    });
  } catch (error) {
    console.error('Error fetching knowledge articles:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
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

    const [row] = await getDb()
      .select()
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.slug, slug))
      .limit(1);

    if (!row) {
      return c.json(
        {
          success: false,
          error: 'Article not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: mapRowToArticle(row),
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

    const [row] = await getDb()
      .select()
      .from(knowledgeArticles)
      .where(eq(knowledgeArticles.id, id))
      .limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRowToArticle(row),
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

    const [row] = await getDb()
      .insert(knowledgeArticles)
      .values({
        title,
        slug: slugify(title),
        status: status || 'Draft',
        summary: summary || null,
        content: content || null,
        categoryId: categoryId || null,
        tags: tags && Array.isArray(tags) ? tags : null,
        authorName: authorName || null,
        authorEmail: authorEmail || null,
        featured: featured !== undefined ? featured : false,
        viewCount: 0,
        createdDate: new Date().toISOString(),
      })
      .returning();

    return c.json({
      success: true,
      data: mapRowToArticle(row),
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

    const values: Partial<typeof knowledgeArticles.$inferInsert> = {};

    if (body.title) {
      values.title = body.title;
      // Regenerate slug if title changes
      values.slug = slugify(body.title);
    }
    if (body.summary !== undefined) values.summary = body.summary;
    if (body.content !== undefined) values.content = body.content;
    if (body.categoryId) values.categoryId = body.categoryId;
    if (body.tags !== undefined) values.tags = body.tags;
    if (body.status) values.status = body.status;
    if (body.authorName) values.authorName = body.authorName;
    if (body.authorEmail) values.authorEmail = body.authorEmail;
    if (body.featured !== undefined) values.featured = body.featured;
    values.lastModified = new Date().toISOString();

    const [row] = await getDb()
      .update(knowledgeArticles)
      .set(values)
      .where(eq(knowledgeArticles.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRowToArticle(row),
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

    await getDb()
      .update(knowledgeArticles)
      .set({ status: 'Archived' })
      .where(eq(knowledgeArticles.id, id));

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

    const [row] = await getDb()
      .update(knowledgeArticles)
      .set({ viewCount: sql`${knowledgeArticles.viewCount} + 1` })
      .where(eq(knowledgeArticles.id, id))
      .returning({ viewCount: knowledgeArticles.viewCount });

    if (!row) {
      return c.json({ success: false, error: 'Article not found' }, 404);
    }

    return c.json({
      success: true,
      viewCount: row.viewCount,
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
