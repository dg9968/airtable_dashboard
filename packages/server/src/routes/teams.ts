/**
 * Teams API Routes (Postgres-backed)
 *
 * Fetch tax preparers/processors from the Better Auth user table. Team-member
 * IDs stored on subscriptions (tax_preparer_id / processor_id) were remapped
 * to these user IDs during the Phase 3 ETL, so IDs are consistent end-to-end.
 */

import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { authUser } from '../db/auth-readonly';

const app = new Hono();

/**
 * GET /api/teams
 * Get all team members
 */
app.get('/', async (c) => {
  try {
    const rows = await getDb()
      .select({ id: authUser.id, name: authUser.name, email: authUser.email })
      .from(authUser)
      .orderBy(asc(authUser.name));

    const teams = rows.map((row) => ({
      id: row.id,
      name: row.name || '',
      email: row.email || '',
    }));

    return c.json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error('Error fetching teams:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
      },
      500
    );
  }
});

export default app;
