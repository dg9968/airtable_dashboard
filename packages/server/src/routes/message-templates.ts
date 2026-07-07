/**
 * Message Templates API Routes (Postgres-backed)
 * CRUD operations for reusable message templates
 */

import { Hono } from 'hono';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { getDb } from '../db/client';
import { messageTemplates } from '../db/schema';

const app = new Hono();

type TemplateRow = typeof messageTemplates.$inferSelect;

function parseVariableDefinitions(raw: string | null) {
  if (!raw) return { variables: [] };
  try {
    return JSON.parse(raw);
  } catch {
    return { variables: [] };
  }
}

function mapRowToTemplate(row: TemplateRow) {
  return {
    id: row.id,
    templateName: row.templateName || '',
    templateCode: row.templateCode || '',
    subjectTemplate: row.subjectTemplate || '',
    contentTemplate: row.contentTemplate || '',
    description: row.description || '',
    variableDefinitions: parseVariableDefinitions(row.variableDefinitions),
    category: row.category || '',
    status: row.status || 'Draft',
    createdDate: row.createdDate || '',
    lastUsedDate: row.lastUsedDate || '',
  };
}

/**
 * GET /api/message-templates
 * List all message templates with optional filters
 *
 * Query params:
 * - status: Filter by status (Active, Draft, Archived)
 * - category: Filter by category
 * - search: Search in template name and description
 */
app.get('/', async (c) => {
  try {
    const { status, category, search } = c.req.query();

    const conditions = [];
    if (status) conditions.push(eq(messageTemplates.status, status));
    if (category) conditions.push(eq(messageTemplates.category, category));
    if (search) {
      conditions.push(
        or(
          ilike(messageTemplates.templateName, `%${search}%`),
          ilike(messageTemplates.description, `%${search}%`)
        )
      );
    }

    const rows = await getDb()
      .select()
      .from(messageTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(messageTemplates.templateName));

    const templates = rows.map(mapRowToTemplate);

    return c.json({
      success: true,
      data: templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      },
      500
    );
  }
});

/**
 * GET /api/message-templates/:id
 * Get a single template by ID
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const [row] = await getDb()
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, id))
      .limit(1);

    if (!row) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    return c.json({
      success: true,
      data: mapRowToTemplate(row),
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      },
      500
    );
  }
});

/**
 * POST /api/message-templates
 * Create a new message template
 */
app.post('/', async (c) => {
  try {
    const body = await c.req.json();

    const {
      templateName,
      templateCode,
      subjectTemplate,
      contentTemplate,
      description,
      variableDefinitions,
      category,
      status,
    } = body;

    // Validation
    if (!templateName || !subjectTemplate || !contentTemplate) {
      return c.json(
        {
          success: false,
          error: 'Template name, subject template, and content template are required',
        },
        400
      );
    }

    const [row] = await getDb()
      .insert(messageTemplates)
      .values({
        templateName,
        templateCode: templateCode || null,
        subjectTemplate,
        contentTemplate,
        description: description || null,
        variableDefinitions: variableDefinitions ? JSON.stringify(variableDefinitions) : null,
        category: category || null,
        status: status || 'Draft',
        createdDate: new Date().toISOString().split('T')[0],
      })
      .returning();

    return c.json({
      success: true,
      data: mapRowToTemplate(row),
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create template',
      },
      500
    );
  }
});

/**
 * PATCH /api/message-templates/:id
 * Update an existing template
 */
app.patch('/:id', async (c) => {
  try {
    const { id } = c.req.param();
    const body = await c.req.json();

    const values: Partial<typeof messageTemplates.$inferInsert> = {};

    if (body.templateName) values.templateName = body.templateName;
    if (body.templateCode) values.templateCode = body.templateCode;
    if (body.subjectTemplate) values.subjectTemplate = body.subjectTemplate;
    if (body.contentTemplate) values.contentTemplate = body.contentTemplate;
    if (body.description !== undefined) values.description = body.description;
    if (body.category) values.category = body.category;
    if (body.status) values.status = body.status;
    if (body.variableDefinitions) {
      values.variableDefinitions = JSON.stringify(body.variableDefinitions);
    }

    const [row] = await getDb()
      .update(messageTemplates)
      .set(values)
      .where(eq(messageTemplates.id, id))
      .returning();

    if (!row) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    // Legacy shape: update response omits createdDate/lastUsedDate
    const { createdDate: _cd, lastUsedDate: _lud, ...template } = mapRowToTemplate(row);

    return c.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error updating template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update template',
      },
      500
    );
  }
});

/**
 * DELETE /api/message-templates/:id
 * Archive a template (soft delete - sets status to Archived)
 */
app.delete('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    await getDb()
      .update(messageTemplates)
      .set({ status: 'Archived' })
      .where(eq(messageTemplates.id, id));

    return c.json({
      success: true,
      message: 'Template archived successfully',
    });
  } catch (error) {
    console.error('Error archiving template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive template',
      },
      500
    );
  }
});

/**
 * POST /api/message-templates/:id/duplicate
 * Duplicate an existing template
 */
app.post('/:id/duplicate', async (c) => {
  try {
    const { id } = c.req.param();

    const [original] = await getDb()
      .select()
      .from(messageTemplates)
      .where(eq(messageTemplates.id, id))
      .limit(1);

    if (!original) {
      return c.json({ success: false, error: 'Template not found' }, 404);
    }

    const [row] = await getDb()
      .insert(messageTemplates)
      .values({
        templateName: `${original.templateName} (Copy)`,
        subjectTemplate: original.subjectTemplate,
        contentTemplate: original.contentTemplate,
        variableDefinitions: original.variableDefinitions,
        category: original.category,
        description: original.description,
        status: 'Draft',
        createdDate: new Date().toISOString().split('T')[0],
      })
      .returning();

    // Legacy shape: duplicate response omits templateCode/createdDate/lastUsedDate
    const { templateCode: _tc, createdDate: _cd, lastUsedDate: _lud, ...template } = mapRowToTemplate(row);

    return c.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Error duplicating template:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to duplicate template',
      },
      500
    );
  }
});

export default app;
