import { createClient, Client } from '@libsql/client';
import path from 'path';
import fs from 'fs';
import { LogEntry, AdminStats, SystemConfig, UniversalMediaItem } from '../types';

let dbClient: Client | null = null;
let isInitialized = false;

// Local SQLite database file stored directly in main project files (Render Free Tier compatible)
const DB_FILE_PATH = path.resolve(process.cwd(), 'omnistream.db');

export function getDatabasePath(): string {
  return DB_FILE_PATH;
}

export async function initDatabase(): Promise<Client> {
  if (dbClient && isInitialized) {
    return dbClient;
  }

  try {
    // Connect to local SQLite file directly in main project directory
    dbClient = createClient({
      url: `file:${DB_FILE_PATH.replace(/\\/g, '/')}`,
    });

    // 1. Create system_config table
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 2. Create audit_logs table
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        platform TEXT NOT NULL,
        action TEXT NOT NULL,
        input TEXT NOT NULL,
        status INTEGER NOT NULL,
        latency_ms INTEGER NOT NULL,
        client_ip TEXT,
        user_agent TEXT,
        error TEXT,
        payload_summary TEXT
      )
    `);

    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON audit_logs (timestamp DESC)
    `);
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_logs_platform ON audit_logs (platform)
    `);
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_logs_action ON audit_logs (action)
    `);

    // 3. Create media_history table
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS media_history (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        platform TEXT NOT NULL,
        title TEXT NOT NULL,
        thumbnail TEXT,
        duration TEXT,
        formats_json TEXT,
        created_at TEXT NOT NULL
      )
    `);

    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_media_created ON media_history (created_at DESC)
    `);
    await dbClient.execute(`
      CREATE INDEX IF NOT EXISTS idx_media_url ON media_history (url)
    `);

    // 4. Create telemetry_counters table
    await dbClient.execute(`
      CREATE TABLE IF NOT EXISTS telemetry_counters (
        counter_name TEXT PRIMARY KEY,
        counter_value INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Initialize telemetry counters if missing
    const defaultCounters = ['totalRequests', 'successfulRequests', 'failedRequests', 'totalStreams', 'totalDownloads'];
    for (const name of defaultCounters) {
      await dbClient.execute({
        sql: `INSERT OR IGNORE INTO telemetry_counters (counter_name, counter_value) VALUES (?, 0)`,
        args: [name],
      });
    }

    // Seed default system configuration if missing
    const defaultSettings: Record<string, string> = {
      baseUrl: (process.env.PREXZY_API_BASE_URL || 'https://prexzyapis.com').replace(/\/+$/, ''),
      announcement: 'OmniStream v1.0 active: High-speed 1080p video, Terabox cloud stream, and 320kbps MP3 extraction ready.',
      announcementActive: 'true',
      rateLimitEnabled: 'false',
      rateLimitRpm: '60',
      maintenanceMode: 'false',
      adminPassword: process.env.ADMIN_PASSWORD || 'admin_stream_pass_2026',
    };

    const now = new Date().toISOString();
    for (const [key, val] of Object.entries(defaultSettings)) {
      await dbClient.execute({
        sql: `INSERT OR IGNORE INTO system_config (key, value, updated_at) VALUES (?, ?, ?)`,
        args: [key, val, now],
      });
    }

    isInitialized = true;
    console.log(`[SQLite] Database initialized successfully at ${DB_FILE_PATH}`);
    return dbClient;
  } catch (error) {
    console.warn('[SQLite] File DB failed, falling back to memory database:', error);
    dbClient = createClient({ url: ':memory:' });
    isInitialized = true;
    return dbClient;
  }
}

// Ensure DB client is ready
async function getDb(): Promise<Client> {
  if (!dbClient || !isInitialized) {
    return await initDatabase();
  }
  return dbClient;
}

/* ==========================================================================
   CONFIG REPOSITORY
   ========================================================================== */

export async function getSystemConfigSql(): Promise<SystemConfig> {
  const db = await getDb();
  try {
    const result = await db.execute(`SELECT key, value FROM system_config`);
    const map = new Map<string, string>();
    for (const row of result.rows) {
      map.set(row.key as string, row.value as string);
    }

    return {
      baseUrl: map.get('baseUrl') || (process.env.PREXZY_API_BASE_URL || 'https://prexzyapis.com').replace(/\/+$/, ''),
      announcement: map.get('announcement') || 'OmniStream v1.0 active: High-speed 1080p video & cloud stream ready.',
      announcementActive: map.get('announcementActive') !== 'false',
      rateLimitEnabled: map.get('rateLimitEnabled') === 'true',
      rateLimitRpm: parseInt(map.get('rateLimitRpm') || '60', 10) || 60,
      maintenanceMode: map.get('maintenanceMode') === 'true',
    };
  } catch (err) {
    console.error('[SQLite] Error reading system_config:', err);
    return {
      baseUrl: (process.env.PREXZY_API_BASE_URL || 'https://prexzyapis.com').replace(/\/+$/, ''),
      announcement: 'OmniStream v1.0 active: High-speed 1080p video & cloud stream ready.',
      announcementActive: true,
      rateLimitEnabled: false,
      rateLimitRpm: 60,
      maintenanceMode: false,
    };
  }
}

export async function updateSystemConfigSql(updates: Partial<SystemConfig>): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  const entries: [string, string][] = [];
  if (updates.baseUrl !== undefined) entries.push(['baseUrl', updates.baseUrl]);
  if (updates.announcement !== undefined) entries.push(['announcement', updates.announcement]);
  if (updates.announcementActive !== undefined) entries.push(['announcementActive', String(updates.announcementActive)]);
  if (updates.rateLimitEnabled !== undefined) entries.push(['rateLimitEnabled', String(updates.rateLimitEnabled)]);
  if (updates.rateLimitRpm !== undefined) entries.push(['rateLimitRpm', String(updates.rateLimitRpm)]);
  if (updates.maintenanceMode !== undefined) entries.push(['maintenanceMode', String(updates.maintenanceMode)]);

  for (const [k, v] of entries) {
    await db.execute({
      sql: `INSERT INTO system_config (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [k, v, now],
    });
  }
}

export async function getAdminPasswordSql(): Promise<string> {
  const db = await getDb();
  try {
    const res = await db.execute({
      sql: `SELECT value FROM system_config WHERE key = 'adminPassword'`,
      args: [],
    });
    if (res.rows.length > 0 && res.rows[0].value) {
      return res.rows[0].value as string;
    }
  } catch {
    // fallback
  }
  return process.env.ADMIN_PASSWORD || 'admin_stream_pass_2026';
}

export async function setAdminPasswordSql(newPassword: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO system_config (key, value, updated_at) VALUES ('adminPassword', ?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [newPassword, now],
  });
}

/* ==========================================================================
   AUDIT LOGS REPOSITORY
   ========================================================================== */

export async function recordLogSql(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<LogEntry> {
  const db = await getDb();
  const fullEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    await db.execute({
      sql: `INSERT INTO audit_logs (id, timestamp, platform, action, input, status, latency_ms, client_ip, user_agent, error, payload_summary)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        fullEntry.id,
        fullEntry.timestamp,
        fullEntry.platform,
        fullEntry.action,
        fullEntry.input,
        fullEntry.status,
        fullEntry.latencyMs,
        fullEntry.clientIp || null,
        fullEntry.userAgent || null,
        fullEntry.error || null,
        fullEntry.payloadSummary || null,
      ],
    });

    // Update telemetry counter
    const isSuccess = fullEntry.status >= 200 && fullEntry.status < 400;
    await db.execute(`UPDATE telemetry_counters SET counter_value = counter_value + 1 WHERE counter_name = 'totalRequests'`);
    if (isSuccess) {
      await db.execute(`UPDATE telemetry_counters SET counter_value = counter_value + 1 WHERE counter_name = 'successfulRequests'`);
    } else {
      await db.execute(`UPDATE telemetry_counters SET counter_value = counter_value + 1 WHERE counter_name = 'failedRequests'`);
    }

    if (fullEntry.action === 'stream') {
      await db.execute(`UPDATE telemetry_counters SET counter_value = counter_value + 1 WHERE counter_name = 'totalStreams'`);
    } else if (fullEntry.action === 'download') {
      await db.execute(`UPDATE telemetry_counters SET counter_value = counter_value + 1 WHERE counter_name = 'totalDownloads'`);
    }
  } catch (err) {
    console.error('[SQLite] Error inserting audit log:', err);
  }

  return fullEntry;
}

export async function queryLogsSql(filters: {
  platform?: string;
  action?: string;
  status?: string;
  q?: string;
  limit?: number;
}): Promise<{ total: number; logs: LogEntry[] }> {
  const db = await getDb();
  try {
    const conditions: string[] = [];
    const args: any[] = [];

    if (filters.platform && filters.platform !== 'all') {
      conditions.push('LOWER(platform) = LOWER(?)');
      args.push(filters.platform);
    }
    if (filters.action && filters.action !== 'all') {
      conditions.push('LOWER(action) = LOWER(?)');
      args.push(filters.action);
    }
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'success') {
        conditions.push('status >= 200 AND status < 400');
      } else if (filters.status === 'error') {
        conditions.push('status >= 400');
      }
    }
    if (filters.q) {
      const queryPattern = `%${filters.q}%`;
      conditions.push('(input LIKE ? OR error LIKE ? OR payload_summary LIKE ?)');
      args.push(queryPattern, queryPattern, queryPattern);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await db.execute({
      sql: `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`,
      args,
    });
    const total = Number(countRes.rows[0]?.total || 0);

    const maxLimit = Math.min(filters.limit || 200, 1000);
    const logsRes = await db.execute({
      sql: `SELECT * FROM audit_logs ${whereClause} ORDER BY timestamp DESC LIMIT ?`,
      args: [...args, maxLimit],
    });

    const logs: LogEntry[] = logsRes.rows.map(row => ({
      id: row.id as string,
      timestamp: row.timestamp as string,
      platform: row.platform as any,
      action: row.action as any,
      input: row.input as string,
      status: Number(row.status),
      latencyMs: Number(row.latency_ms),
      clientIp: (row.client_ip as string) || undefined,
      userAgent: (row.user_agent as string) || undefined,
      error: (row.error as string) || undefined,
      payloadSummary: (row.payload_summary as string) || undefined,
    }));

    return { total, logs };
  } catch (err) {
    console.error('[SQLite] Error querying logs:', err);
    return { total: 0, logs: [] };
  }
}

export async function deleteLogSql(id: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.execute({
    sql: `DELETE FROM audit_logs WHERE id = ?`,
    args: [id],
  });
  return (res.rowsAffected || 0) > 0;
}

export async function clearLogsSql(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM audit_logs`);
}

/* ==========================================================================
   TELEMETRY & STATS REPOSITORY
   ========================================================================== */

export async function getAdminStatsSql(): Promise<AdminStats> {
  const db = await getDb();
  try {
    // Read counters
    const counterRes = await db.execute(`SELECT counter_name, counter_value FROM telemetry_counters`);
    const counters = new Map<string, number>();
    for (const row of counterRes.rows) {
      counters.set(row.counter_name as string, Number(row.counter_value || 0));
    }

    // Platform breakdown
    const platformRes = await db.execute(`
      SELECT platform, COUNT(*) as count FROM audit_logs GROUP BY platform
    `);
    const platformBreakdown: Record<string, number> = {
      youtube: 0,
      terabox: 0,
      facebook: 0,
      instagram: 0,
      tiktok: 0,
      pinterest: 0,
      xnxx: 0,
      xvideos: 0,
      aio: 0,
      system: 0,
    };
    for (const row of platformRes.rows) {
      const p = String(row.platform).toLowerCase();
      platformBreakdown[p] = Number(row.count || 0);
    }

    // Action breakdown
    const actionRes = await db.execute(`
      SELECT action, COUNT(*) as count FROM audit_logs GROUP BY action
    `);
    const actionBreakdown: Record<string, number> = {
      extract: 0,
      stream: 0,
      download: 0,
      search: 0,
      admin: 0,
    };
    for (const row of actionRes.rows) {
      const a = String(row.action).toLowerCase();
      actionBreakdown[a] = Number(row.count || 0);
    }

    // Average latency & recent errors
    const latencyRes = await db.execute(`
      SELECT AVG(latency_ms) as avg_latency FROM (
        SELECT latency_ms FROM audit_logs WHERE latency_ms > 0 ORDER BY timestamp DESC LIMIT 100
      )
    `);
    const avgLatency = Math.round(Number(latencyRes.rows[0]?.avg_latency || 0));

    const errRes = await db.execute(`
      SELECT COUNT(*) as err_count FROM audit_logs WHERE status >= 400
    `);
    const recentErrorsCount = Number(errRes.rows[0]?.err_count || 0);

    return {
      totalRequests: counters.get('totalRequests') || 0,
      successfulRequests: counters.get('successfulRequests') || 0,
      failedRequests: counters.get('failedRequests') || 0,
      totalStreams: counters.get('totalStreams') || 0,
      totalDownloads: counters.get('totalDownloads') || 0,
      averageLatencyMs: avgLatency,
      platformBreakdown: platformBreakdown as any,
      actionBreakdown: actionBreakdown as any,
      recentErrorsCount,
    };
  } catch (err) {
    console.error('[SQLite] Error reading admin stats:', err);
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalStreams: 0,
      totalDownloads: 0,
      averageLatencyMs: 0,
      platformBreakdown: {
        youtube: 0,
        terabox: 0,
        facebook: 0,
        instagram: 0,
        tiktok: 0,
        pinterest: 0,
        xnxx: 0,
        xvideos: 0,
        aio: 0,
        system: 0,
      },
      actionBreakdown: {
        extract: 0,
        stream: 0,
        download: 0,
        search: 0,
        admin: 0,
      },
      recentErrorsCount: 0,
    };
  }
}

export async function resetStatsSql(): Promise<void> {
  const db = await getDb();
  await db.execute(`UPDATE telemetry_counters SET counter_value = 0`);
}

/* ==========================================================================
   MEDIA HISTORY REPOSITORY
   ========================================================================== */

export async function saveMediaHistorySql(media: UniversalMediaItem): Promise<void> {
  const db = await getDb();
  try {
    const id = `media_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.execute({
      sql: `INSERT OR REPLACE INTO media_history (id, url, platform, title, thumbnail, duration, formats_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        media.sourceUrl,
        media.platform,
        media.title,
        media.thumbnail || null,
        media.duration || null,
        JSON.stringify(media.downloads),
        new Date().toISOString(),
      ],
    });
  } catch (err) {
    console.warn('[SQLite] Could not save media history:', err);
  }
}

export async function getRecentMediaHistorySql(limit = 30): Promise<any[]> {
  const db = await getDb();
  try {
    const res = await db.execute({
      sql: `SELECT * FROM media_history ORDER BY created_at DESC LIMIT ?`,
      args: [limit],
    });
    return res.rows.map(r => ({
      id: r.id,
      url: r.url,
      platform: r.platform,
      title: r.title,
      thumbnail: r.thumbnail,
      duration: r.duration,
      downloads: r.formats_json ? JSON.parse(r.formats_json as string) : [],
      createdAt: r.created_at,
    }));
  } catch (err) {
    console.error('[SQLite] Error reading media history:', err);
    return [];
  }
}

/* ==========================================================================
   DATABASE HEALTH & DIAGNOSTICS
   ========================================================================== */

export async function getDatabaseDiagnostics(): Promise<{
  connected: boolean;
  type: string;
  path: string;
  fileSizeBytes: number;
  totalLogs: number;
  totalMediaHistory: number;
}> {
  try {
    const db = await getDb();
    const logsRes = await db.execute(`SELECT COUNT(*) as c FROM audit_logs`);
    const mediaRes = await db.execute(`SELECT COUNT(*) as c FROM media_history`);
    let size = 0;
    if (fs.existsSync(DB_FILE_PATH)) {
      size = fs.statSync(DB_FILE_PATH).size;
    }
    return {
      connected: true,
      type: 'SQLite (@libsql/client)',
      path: DB_FILE_PATH,
      fileSizeBytes: size,
      totalLogs: Number(logsRes.rows[0]?.c || 0),
      totalMediaHistory: Number(mediaRes.rows[0]?.c || 0),
    };
  } catch (err) {
    return {
      connected: false,
      type: 'SQLite (@libsql/client)',
      path: DB_FILE_PATH,
      fileSizeBytes: 0,
      totalLogs: 0,
      totalMediaHistory: 0,
    };
  }
}
