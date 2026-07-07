/**
 * Knowledge Categories API Routes (Postgres-backed)
 * CRUD operations for knowledge base categories
 */

import { Hono } from 'hono';
import { asc, count, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { knowledgeCategories, knowledgeArticles } from '../db/schema';

const app = new Hono();

type CategoryRow = typeof knowledgeCategories.$inferSelect;

function mapRowToCategory(row: CategoryRow, articleCount?: number) {
  const category: Record<string, unknown> = {
    id: row.id,
    name: row.name || '',
    slug: row.slug || '',
    description: row.description || '',
    icon: row.icon || 'book',
    color: row.color || 'primary',
    sortOrder: row.sortOrder || 0,
    status: row.status || 'Active',
  };
  if (articleCount !== undefined) category.articleCount = articleCount;
  return category;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * GET /api/knowledge-categories
 * List all knowledge categories
 *
 * Query params:
 * - status: Filter by status (Active, Inactive)
 */
app.get('/', async (c) => {
  try {
    const { status } = c.req.query();

    const db = getDb();
    const rows = await db
      .select({
        category: knowledgeCategories,
        articleCount: count(knowledgeArticles.id),
      })
      .from(knowledgeCategories)
      .leftJoin(knowledgeArticles, eq(knowledgeArticles.categoryId, knowledgeCategories.id))
      .where(eq(knowledgeCategories.status, status || 'Active'))
      .groupBy(knowledgeCategories.id)
      .orderBy(asc(knowledgeCategories.sortOrder));

    const categories = rows.map((r) => mapRowToCategory(r.category, r.articleCount));

    return c.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('Error fetching knowledge categories:', error);
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
 * GET /api/knowledge-categories/:id
 * Get a single category by ID
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const db = getDb();
    const [row] = await db
      .select({
        category: knowledgeCategories,
        articleCount: count(knowledgeArticles.id),
      })
      .from(knowledgeCategories)
      .leftJoin(knowledgeArticles, eq(knowledgeArticles.categoryId, knowledgeCategories.id))
      .where(eq(knowledgeCategories.id, id))
      .groupBy(knowledgeCategories.id)
      .limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRowToCategory(row.category, row.articleCount),
    });
  } catch (error) {
    console.error('Error fetching knowledge category:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch category',
      },
      500
    );
  }
});

/**
 * POST /api/knowledge-categories
 * Create a new category
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();

    const { name, description, icon, color, sortOrder } = body;

    if (!name) {
      return c.json(
        {
          success: false,
          error: 'Category name is required',
        },
        400
      );
    }

    const [row] = await getDb()
      .insert(knowledgeCategories)
      .values({
        name,
        slug: slugify(name),
        status: 'Active',
        description: description || null,
        icon: icon || null,
        color: color || null,
        sortOrder: sortOrder !== undefined ? sortOrder : null,
      })
      .returning();

    return c.json({
      success: true,
      data: mapRowToCategory(row),
    });
  } catch (error) {
    console.error('Error creating knowledge category:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create category',
      },
      500
    );
  }
});

/**
 * PATCH /api/knowledge-categories/:id
 * Update an existing category
 */
app.patch('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const values: Partial<typeof knowledgeCategories.$inferInsert> = {};

    if (body.name) {
      values.name = body.name;
      // Regenerate slug if name changes
      values.slug = slugify(body.name);
    }
    if (body.description !== undefined) values.description = body.description;
    if (body.icon) values.icon = body.icon;
    if (body.color) values.color = body.color;
    if (body.sortOrder !== undefined) values.sortOrder = body.sortOrder;
    if (body.status) values.status = body.status;

    const [row] = await getDb()
      .update(knowledgeCategories)
      .set(values)
      .where(eq(knowledgeCategories.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Category not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRowToCategory(row),
    });
  } catch (error) {
    console.error('Error updating knowledge category:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update category',
      },
      500
    );
  }
});

/**
 * DELETE /api/knowledge-categories/:id
 * Deactivate a category (soft delete)
 */
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    await getDb()
      .update(knowledgeCategories)
      .set({ status: 'Inactive' })
      .where(eq(knowledgeCategories.id, id));

    return c.json({
      success: true,
      message: 'Category deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating knowledge category:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate category',
      },
      500
    );
  }
});

export default app;
