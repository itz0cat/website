import pg from 'pg';

const connectionString = process.env.DATABASE_URL ||
  process.env.INTERNAL_DATABASE_URL ||
  'postgresql://cattags_user:9nMPZwSlD3hffwWj3fb6LTPuM8OMVOO6@dpg-daed4nv40ujc73eotshg-a.oregon-postgres.render.com:5432/cattags';

export const dbPool = new pg.Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 4,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000
});

export async function initDbState() {
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS proxy_pinger_state (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    console.log('[DB] PostgreSQL proxy_pinger_state table initialized.');
    return true;
  } catch (err) {
    console.warn('[DB] Failed to initialize table:', err.message);
    return false;
  }
}

export async function getDbValue(key, defaultValue = null) {
  try {
    const res = await dbPool.query('SELECT value FROM proxy_pinger_state WHERE key = $1', [key]);
    return res.rows.length > 0 ? res.rows[0].value : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function setDbValue(key, value) {
  try {
    await dbPool.query(`
      INSERT INTO proxy_pinger_state (key, value, updated_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = NOW();
    `, [key, String(value)]);
    return true;
  } catch {
    return false;
  }
}

export async function saveWorkingProxiesToDb(proxyUrls) {
  if (!Array.isArray(proxyUrls) || proxyUrls.length === 0) return;
  return setDbValue('working_proxies', JSON.stringify(proxyUrls));
}

export async function getWorkingProxiesFromDb() {
  const raw = await getDbValue('working_proxies');
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
