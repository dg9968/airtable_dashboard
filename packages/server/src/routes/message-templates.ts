/**
 * Message Templates API Routes
 * CRUD operations for reusable message templates
 */

import { Hono } from 'hono';
import { fetchAllRecords, createRecords, updateRecords, getRecord } from '../lib/airtable-helpers.js';

const app = new Hono();

const BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const TEMPLATES_TABLE = 'Message Templates';

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

    // Build filter formula
    const filters: string[] = [];

    if (status) {
      filters.push(`{Status} = '${status}'`);
    }

    if (category) {
      filters.push(`{Category} = '${category}'`);
    }

    if (search) {
      filters.push(
        `OR(` +
        `FIND(LOWER('${search}'), LOWER({Template Name})), ` +
        `FIND(LOWER('${search}'), LOWER({Description}))` +
        `)`
      );
    }

    const filterByFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : undefined;

    const records = await fetchAllRecords(BASE_ID, TEMPLATES_TABLE, {
      filterByFormula,
      sort: [{ field: 'Template Name', direction: 'asc' }],
    });

    const templates = records.map((record) => ({
      id: record.id,
      templateName: record.fields['Template Name'] || '',
      templateCode: record.fields['Template Code'] || '',
      subjectTemplate: record.fields['Subject Template'] || '',
      contentTemplate: record.fields['Content Template'] || '',
      description: record.fields['Description'] || '',
      variableDefinitions: record.fields['Variable Definitions']
        ? JSON.parse(record.fields['Variable Definitions'])
        : { variables: [] },
      category: record.fields['Category'] || '',
      status: record.fields['Status'] || 'Draft',
      createdDate: record.fields['Created Date'] || '',
      lastUsedDate: record.fields['Last Used Date'] || '',
    }));

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

    const record = await getRecord(BASE_ID, TEMPLATES_TABLE, id);

    const template = {
      id: record.id,
      templateName: record.fields['Template Name'] || '',
      templateCode: record.fields['Template Code'] || '',
      subjectTemplate: record.fields['Subject Template'] || '',
      contentTemplate: record.fields['Content Template'] || '',
      description: record.fields['Description'] || '',
      variableDefinitions: record.fields['Variable Definitions']
        ? JSON.parse(record.fields['Variable Definitions'])
        : { variables: [] },
      category: record.fields['Category'] || '',
      status: record.fields['Status'] || 'Draft',
      createdDate: record.fields['Created Date'] || '',
      lastUsedDate: record.fields['Last Used Date'] || '',
    };

    return c.json({
      success: true,
      data: template,
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
 *
 * Expected body:
 * {
 *   templateName: string,
 *   templateCode?: string,
 *   subjectTemplate: string,
 *   contentTemplate: string,
 *   description?: string,
 *   variableDefinitions: { variables: VariableDefinition[] },
 *   category?: string,
 *   status?: 'Active' | 'Draft' | 'Archived'
 * }
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

    const fields: Record<string, any> = {
      'Template Name': templateName,
      'Subject Template': subjectTemplate,
      'Content Template': contentTemplate,
      'Status': status || 'Draft',
      'Created Date': new Date().toISOString().split('T')[0],
    };

    if (templateCode) fields['Template Code'] = templateCode;
    if (description) fields['Description'] = description;
    if (category) fields['Category'] = category;

    if (variableDefinitions) {
      fields['Variable Definitions'] = JSON.stringify(variableDefinitions);
    }

    const createdRecords = await createRecords(BASE_ID, TEMPLATES_TABLE, [{ fields }]);

    const template = {
      id: createdRecords[0].id,
      templateName: createdRecords[0].fields['Template Name'],
      templateCode: createdRecords[0].fields['Template Code'] || '',
      subjectTemplate: createdRecords[0].fields['Subject Template'],
      contentTemplate: createdRecords[0].fields['Content Template'],
      description: createdRecords[0].fields['Description'] || '',
      variableDefinitions: createdRecords[0].fields['Variable Definitions']
        ? JSON.parse(createdRecords[0].fields['Variable Definitions'])
        : { variables: [] },
      category: createdRecords[0].fields['Category'] || '',
      status: createdRecords[0].fields['Status'] || 'Draft',
      createdDate: createdRecords[0].fields['Created Date'] || '',
    };

    return c.json({
      success: true,
      data: template,
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

    const fields: Record<string, any> = {};

    if (body.templateName) fields['Template Name'] = body.templateName;
    if (body.templateCode) fields['Template Code'] = body.templateCode;
    if (body.subjectTemplate) fields['Subject Template'] = body.subjectTemplate;
    if (body.contentTemplate) fields['Content Template'] = body.contentTemplate;
    if (body.description !== undefined) fields['Description'] = body.description;
    if (body.category) fields['Category'] = body.category;
    if (body.status) fields['Status'] = body.status;

    if (body.variableDefinitions) {
      fields['Variable Definitions'] = JSON.stringify(body.variableDefinitions);
    }

    const updatedRecords = await updateRecords(BASE_ID, TEMPLATES_TABLE, [
      { id, fields },
    ]);

    const template = {
      id: updatedRecords[0].id,
      templateName: updatedRecords[0].fields['Template Name'] || '',
      templateCode: updatedRecords[0].fields['Template Code'] || '',
      subjectTemplate: updatedRecords[0].fields['Subject Template'] || '',
      contentTemplate: updatedRecords[0].fields['Content Template'] || '',
      description: updatedRecords[0].fields['Description'] || '',
      variableDefinitions: updatedRecords[0].fields['Variable Definitions']
        ? JSON.parse(updatedRecords[0].fields['Variable Definitions'])
        : { variables: [] },
      category: updatedRecords[0].fields['Category'] || '',
      status: updatedRecords[0].fields['Status'] || 'Draft',
    };

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

    await updateRecords(BASE_ID, TEMPLATES_TABLE, [
      {
        id,
        fields: { Status: 'Archived' },
      },
    ]);

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

    const original = await getRecord(BASE_ID, TEMPLATES_TABLE, id);

    const fields: Record<string, any> = {
      'Template Name': `${original.fields['Template Name']} (Copy)`,
      'Subject Template': original.fields['Subject Template'],
      'Content Template': original.fields['Content Template'],
      'Variable Definitions': original.fields['Variable Definitions'],
      'Category': original.fields['Category'],
      'Status': 'Draft',
      'Created Date': new Date().toISOString().split('T')[0],
    };

    if (original.fields['Description']) {
      fields['Description'] = original.fields['Description'];
    }

    const createdRecords = await createRecords(BASE_ID, TEMPLATES_TABLE, [{ fields }]);

    const template = {
      id: createdRecords[0].id,
      templateName: createdRecords[0].fields['Template Name'],
      subjectTemplate: createdRecords[0].fields['Subject Template'],
      contentTemplate: createdRecords[0].fields['Content Template'],
      description: createdRecords[0].fields['Description'] || '',
      variableDefinitions: createdRecords[0].fields['Variable Definitions']
        ? JSON.parse(createdRecords[0].fields['Variable Definitions'])
        : { variables: [] },
      category: createdRecords[0].fields['Category'] || '',
      status: createdRecords[0].fields['Status'] || 'Draft',
    };

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
