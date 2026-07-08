/**
 * Team Directory API Routes
 *
 * Lists every Better Auth user alongside their optional staff_directory
 * details (extension, cell phone, title, direct line). Readable by any
 * authenticated user; editable by admins only.
 */

import { Hono } from 'hono';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { authUser } from '../db/auth-readonly';
import { staffDirectory } from '../db/schema';
import { authMiddleware, requireAdmin } from '../middleware/auth';

const app = new Hono();

/**
 * GET /api/team-directory
 * Any authenticated user. LEFT JOIN so every user appears even without a
 * staff_directory row yet.
 */
app.get('/', authMiddleware, async (c) => {
  try {
    const rows = await getDb()
      .select({
        userId: authUser.id,
        name: authUser.name,
        email: authUser.email,
        extension: staffDirectory.extension,
        cellPhone: staffDirectory.cellPhone,
        title: staffDirectory.title,
        directLine: staffDirectory.directLine,
      })
      .from(authUser)
      .leftJoin(staffDirectory, eq(staffDirectory.userId, authUser.id))
      .orderBy(asc(authUser.name));

    return c.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching team directory:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch team directory' },
      500
    );
  }
});

/**
 * PUT /api/team-directory/:userId
 * Admin only. Upserts extension/cellPhone/title/directLine for a user.
 */
app.put('/:userId', authMiddleware, requireAdmin, async (c) => {
  try {
    const { userId } = c.req.param();
    const { extension, cellPhone, title, directLine } = await c.req.json();

    const [row] = await getDb()
      .insert(staffDirectory)
      .values({
        userId,
        extension: extension || null,
        cellPhone: cellPhone || null,
        title: title || null,
        directLine: directLine || null,
      })
      .onConflictDoUpdate({
        target: staffDirectory.userId,
        set: {
          extension: extension || null,
          cellPhone: cellPhone || null,
          title: title || null,
          directLine: directLine || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json({ success: true, data: row });
  } catch (error) {
    console.error('Error updating team directory entry:', error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update entry' },
      500
    );
  }
});

export default app;
