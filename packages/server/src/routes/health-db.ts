import { Hono } from 'hono';
import { getPool } from '../db/client';

const app = new Hono();

// GET /api/health/db — verifies the server can reach Postgres.
app.get('/db', async (c) => {
  try {
    const result = await getPool().query('SELECT 1 AS ok');
    return c.json({
      status: 'ok',
      postgres: result.rows[0]?.ok === 1,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Postgres health check failed:', error);
    return c.json(
      {
        status: 'error',
        postgres: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      503
    );
  }
});

export default app;
