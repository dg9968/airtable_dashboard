/**
 * Knowledge Categories API Routes
 * CRUD operations for knowledge base categories
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, getRecord } from '../lib/airtable-helpers.js';

const app = new Hono();

const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const CATEGORIES_TABLE = 'Knowledge Categories';

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

    const filters: string[] = [];

    if (status) {
      filters.push(`{Status} = '${status}'`);
    } else {
      // Default to active categories only
      filters.push(`{Status} = 'Active'`);
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    const records = await fetchAllRecords(BASE_ID, CATEGORIES_TABLE, {
      filterByFormula,
      sort: [{ field: 'Sort Order', direction: 'asc' }],
    });

    const categories = records.map((record) => ({
      id: record.id,
      name: record.fields['Name'] || '',
      slug: record.fields['Slug'] || '',
      description: record.fields['Description'] || '',
      icon: record.fields['Icon'] || 'book',
      color: record.fields['Color'] || 'primary',
      sortOrder: record.fields['Sort Order'] || 0,
      status: record.fields['Status'] || 'Active',
      articleCount: Array.isArray(record.fields['Articles']) ? record.fields['Articles'].length : 0,
    }));

    return c.json({
      success: true,
      data: categories,
      count: categories.length,
    });
  } catch (error) {
    console.error('Error fetching knowledge categories:', error);

    // Check if table doesn't exist yet
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotAuthorized = errorMessage.includes('NOT_AUTHORIZED') || errorMessage.includes('Could not find table');

    if (isNotAuthorized) {
      return c.json({
        success: true,
        data: [],
        count: 0,
        setupRequired: true,
        message: 'Knowledge Categories table not found. Please create it in Airtable.',
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
 * GET /api/knowledge-categories/:id
 * Get a single category by ID
 */
app.get('/:id', async (c) => {
  try {
    const { id } = c.req.param();

    const record = await getRecord(BASE_ID, CATEGORIES_TABLE, id);

    const category = {
      id: record.id,
      name: record.fields['Name'] || '',
      slug: record.fields['Slug'] || '',
      description: record.fields['Description'] || '',
      icon: record.fields['Icon'] || 'book',
      color: record.fields['Color'] || 'primary',
      sortOrder: record.fields['Sort Order'] || 0,
      status: record.fields['Status'] || 'Active',
      articleCount: Array.isArray(record.fields['Articles']) ? record.fields['Articles'].length : 0,
    };

    return c.json({
      success: true,
      data: category,
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

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const fields: Record<string, any> = {
      'Name': name,
      'Slug': slug,
      'Status': 'Active',
    };

    if (description) fields['Description'] = description;
    if (icon) fields['Icon'] = icon;
    if (color) fields['Color'] = color;
    if (sortOrder !== undefined) fields['Sort Order'] = sortOrder;

    const createdRecords = await createRecords(BASE_ID, CATEGORIES_TABLE, [{ fields }]);

    const category = {
      id: createdRecords[0].id,
      name: createdRecords[0].fields['Name'] || '',
      slug: createdRecords[0].fields['Slug'] || '',
      description: createdRecords[0].fields['Description'] || '',
      icon: createdRecords[0].fields['Icon'] || 'book',
      color: createdRecords[0].fields['Color'] || 'primary',
      sortOrder: createdRecords[0].fields['Sort Order'] || 0,
      status: createdRecords[0].fields['Status'] || 'Active',
    };

    return c.json({
      success: true,
      data: category,
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

    const fields: Record<string, any> = {};

    if (body.name) {
      fields['Name'] = body.name;
      // Regenerate slug if name changes
      fields['Slug'] = body.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
    }
    if (body.description !== undefined) fields['Description'] = body.description;
    if (body.icon) fields['Icon'] = body.icon;
    if (body.color) fields['Color'] = body.color;
    if (body.sortOrder !== undefined) fields['Sort Order'] = body.sortOrder;
    if (body.status) fields['Status'] = body.status;

    const updatedRecords = await updateRecords(BASE_ID, CATEGORIES_TABLE, [
      { id, fields },
    ]);

    const category = {
      id: updatedRecords[0].id,
      name: updatedRecords[0].fields['Name'] || '',
      slug: updatedRecords[0].fields['Slug'] || '',
      description: updatedRecords[0].fields['Description'] || '',
      icon: updatedRecords[0].fields['Icon'] || 'book',
      color: updatedRecords[0].fields['Color'] || 'primary',
      sortOrder: updatedRecords[0].fields['Sort Order'] || 0,
      status: updatedRecords[0].fields['Status'] || 'Active',
    };

    return c.json({
      success: true,
      data: category,
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

    await updateRecords(BASE_ID, CATEGORIES_TABLE, [
      {
        id,
        fields: { Status: 'Inactive' },
      },
    ]);

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
