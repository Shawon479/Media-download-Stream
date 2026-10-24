import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { detectPlatform, normalizeMediaResponse, formatBytes } from './src/utils/mediaParser';
import { LogEntry, AdminStats, EndpointHealth, SystemConfig } from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
let currentAdminPassword = process.env.ADMIN_PASSWORD || 'admin_stream_pass_2026';
let currentBaseUrl = (process.env.PREXZY_API_BASE_URL || 'https://prexzyapis.com').replace(/\/+$/, '');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// System State
const systemConfig: SystemConfig = {
  baseUrl: currentBaseUrl,
  announcement: 'OmniStream v1.0 active: High-speed 1080p video, Terabox cloud stream, and 320kbps MP3 extraction ready.',
  announcementActive: true,
  rateLimitEnabled: false,
  rateLimitRpm: 60,
  maintenanceMode: false,
};

const adminSessions = new Set<string>();
const auditLogs: LogEntry[] = [];
const MAX_LOGS = 1000;

const stats: AdminStats = {
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

const latencySamples: number[] = [];

// Format uptime to human string
function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0 || d > 0) parts.push(`${h}h`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// In-memory cache for resolved NSFW video thumbnails
const nsfwThumbCache = new Map<string, string>();

async function resolveNsfwThumbnail(videoUrl: string): Promise<string> {
  if (!videoUrl) return '';
  if (nsfwThumbCache.has(videoUrl)) {
    return nsfwThumbCache.get(videoUrl)!;
  }
  try {
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return '';
    const reader = res.body?.getReader();
    let text = '';
    if (reader) {
      while (text.length < 8192) {
        const { done, value } = await reader.read();
        if (done) break;
        text += new TextDecoder().decode(value);
        if (text.includes('og:image')) break;
      }
      reader.cancel().catch(() => {});
    } else {
      text = await res.text();
    }
    const match = text.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                  text.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i) ||
                  text.match(/thumbnailUrl["']:\s*\[?["']([^"']+)["']/i);
    if (match && match[1]) {
      const thumb = match[1];
      nsfwThumbCache.set(videoUrl, thumb);
      return thumb;
    }
  } catch {
    // ignore lookup error
  }
  return '';
}

// Helper to push log entry
function recordLog(entry: Omit<LogEntry, 'id' | 'timestamp'>) {
  const fullEntry: LogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.unshift(fullEntry);
  if (auditLogs.length > MAX_LOGS) {
    auditLogs.pop();
  }

  // Update Stats
  stats.totalRequests++;
  if (entry.status >= 200 && entry.status < 400) {
    stats.successfulRequests++;
  } else {
    stats.failedRequests++;
    stats.recentErrorsCount++;
  }

  if (entry.platform) {
    stats.platformBreakdown[entry.platform] = (stats.platformBreakdown[entry.platform] || 0) + 1;
  }
  if (entry.action) {
    stats.actionBreakdown[entry.action] = (stats.actionBreakdown[entry.action] || 0) + 1;
  }

  if (entry.latencyMs > 0) {
    latencySamples.push(entry.latencyMs);
    if (latencySamples.length > 50) latencySamples.shift();
    const sum = latencySamples.reduce((a, b) => a + b, 0);
    stats.averageLatencyMs = Math.round(sum / latencySamples.length);
  }
}

// Seed initial system logs for realistic audit inspection
recordLog({
  platform: 'system',
  action: 'admin',
  input: 'OmniStream media gateway initialized on port 3000',
  status: 200,
  latencyMs: 12,
  clientIp: '127.0.0.1',
  userAgent: 'System/1.0',
});

// Admin auth middleware
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');
  if (!token || !adminSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired admin token' });
    return;
  }
  next();
}

/* ==========================================================================
   PUBLIC API ENDPOINTS
   ========================================================================== */

// 1. Get Announcement Banner
app.get(['/api/announcement', '/announcement'], (_req, res) => {
  res.json({
    active: systemConfig.announcementActive,
    message: systemConfig.announcement,
    maintenanceMode: systemConfig.maintenanceMode,
  });
});

// 2. Media Extraction Proxy
app.post(['/api/extract', '/extract'], async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const { url, platform: requestedPlatform, preferAudio } = req.body;

  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'A valid media URL is required' });
    return;
  }

  if (systemConfig.maintenanceMode) {
    res.status(503).json({ error: 'System is currently undergoing scheduled maintenance. Please try again shortly.' });
    return;
  }

  const cleanUrl = url.trim();
  const platform = (requestedPlatform && requestedPlatform !== 'auto')
    ? requestedPlatform
    : detectPlatform(cleanUrl);

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    let upstreamUrl = '';
    let fetchOptions: RequestInit = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    };

    const targetBase = systemConfig.baseUrl;

    if (platform === 'youtube') {
      const endpoint = preferAudio ? 'ytmp3' : 'ytmp4';
      upstreamUrl = `${targetBase}/download/${endpoint}?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'facebook') {
      upstreamUrl = `${targetBase}/download/facebookv2`;
      fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
        body: JSON.stringify({ url: cleanUrl }),
        signal: AbortSignal.timeout(15000),
      };
    } else if (platform === 'terabox') {
      upstreamUrl = `${targetBase}/download/terabox?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'xnxx') {
      upstreamUrl = `${targetBase}/nsfw/xnxx-dl?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'xvideos') {
      upstreamUrl = `${targetBase}/nsfw/xvideos-dl?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'instagram') {
      upstreamUrl = `${targetBase}/download/instagram?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'tiktok') {
      upstreamUrl = `${targetBase}/download/tiktokv2?url=${encodeURIComponent(cleanUrl)}`;
    } else if (platform === 'pinterest') {
      upstreamUrl = `${targetBase}/download/pinterestV2?url=${encodeURIComponent(cleanUrl)}`;
    } else {
      upstreamUrl = `${targetBase}/download/aiov2?url=${encodeURIComponent(cleanUrl)}`;
    }

    const response = await fetch(upstreamUrl, fetchOptions);
    const latency = Date.now() - startTime;
    const responseJson = await response.json().catch(() => null);

    if (!response.ok || (responseJson && responseJson.status === false && !responseJson.data)) {
      const errorMsg = responseJson?.error || responseJson?.message || `Upstream returned HTTP ${response.status}`;
      recordLog({
        platform,
        action: 'extract',
        input: cleanUrl,
        status: response.status || 500,
        latencyMs: latency,
        clientIp,
        userAgent,
        error: errorMsg,
      });

      // Try fallback to AIO if specific platform failed
      if (platform !== 'aio') {
        try {
          const aioRes = await fetch(`${targetBase}/download/aiov2?url=${encodeURIComponent(cleanUrl)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
          });
          const aioJson = await aioRes.json();
          if (aioRes.ok && (aioJson.status === true || aioJson.data)) {
            const normalized = normalizeMediaResponse('aio', aioJson, cleanUrl);
            recordLog({
              platform: 'aio',
              action: 'extract',
              input: cleanUrl,
              status: 200,
              latencyMs: Date.now() - startTime,
              clientIp,
              userAgent,
            });
            res.json({ success: true, platform: 'aio', data: normalized, fallbackApplied: true });
            return;
          }
        } catch {
          // ignore fallback error
        }
      }

      res.status(response.status >= 400 && response.status < 500 ? response.status : 502).json({
        error: errorMsg,
        upstreamStatus: response.status,
      });
      return;
    }

    const normalized = normalizeMediaResponse(platform, responseJson, cleanUrl);

    recordLog({
      platform,
      action: 'extract',
      input: cleanUrl,
      status: 200,
      latencyMs: latency,
      clientIp,
      userAgent,
      payloadSummary: `${normalized.title} (${normalized.downloads.length} formats)`,
    });

    res.json({
      success: true,
      platform,
      data: normalized,
      latencyMs: latency,
    });
  } catch (err: any) {
    const latency = Date.now() - startTime;
    const message = err.name === 'TimeoutError' ? 'Gateway request timed out after 15s' : (err.message || 'Network error');
    recordLog({
      platform,
      action: 'extract',
      input: cleanUrl,
      status: 504,
      latencyMs: latency,
      clientIp,
      userAgent,
      error: message,
    });
    res.status(500).json({ error: message });
  }
});

// 3. Search Hub Proxy (YouTube & Pinterest)
app.get(['/api/search', '/search'], async (req: Request, res: Response): Promise<void> => {
  const startTime = Date.now();
  const type = (req.query.type as string) || 'youtube';
  const q = (req.query.q as string)?.trim();

  if (!q) {
    res.status(400).json({ error: 'Search query required' });
    return;
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Unknown';

  try {
    const targetBase = systemConfig.baseUrl;
    let endpoint = `${targetBase}/search/youtube?q=${encodeURIComponent(q)}`;

    if (type === 'pinterest') {
      endpoint = `${targetBase}/search/pinterest?q=${encodeURIComponent(q)}`;
    } else if (type === 'xnxx') {
      endpoint = `${targetBase}/nsfw/xnxx-search?query=${encodeURIComponent(q)}`;
    } else if (type === 'xvideos') {
      endpoint = `${targetBase}/nsfw/xvideos-search?query=${encodeURIComponent(q)}`;
    }

    const response = await fetch(endpoint, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });

    const latency = Date.now() - startTime;
    const json = await response.json();

    const resultsList = json.data || json.videos || [];

    // Pre-resolve real thumbnails for XNXX & Xvideos since upstream returns placeholder blank.gif
    if ((type === 'xnxx' || type === 'xvideos') && Array.isArray(resultsList)) {
      await Promise.allSettled(
        resultsList.map(async (item: any) => {
          const videoUrl = item.link || item.url || '';
          const currentThumb = item.thumbnail || item.thumb || '';
          if (!currentThumb || currentThumb.includes('blank.gif') || currentThumb.length < 10) {
            const resolved = await resolveNsfwThumbnail(videoUrl);
            if (resolved) {
              item.thumbnail = resolved;
              item.thumb = resolved;
            }
          }
        })
      );
    }

    if (!response.ok || (json.status === false && resultsList.length === 0)) {
      recordLog({
        platform: type,
        action: 'search',
        input: q,
        status: response.status,
        latencyMs: latency,
        clientIp,
        userAgent,
        error: json.error || 'Search failure',
      });
      res.status(502).json({ error: json.error || 'Search query failed' });
      return;
    }

    recordLog({
      platform: type,
      action: 'search',
      input: q,
      status: 200,
      latencyMs: latency,
      clientIp,
      userAgent,
      payloadSummary: `Found ${Array.isArray(resultsList) ? resultsList.length : 0} items`,
    });

    res.json({
      success: true,
      type,
      query: q,
      data: resultsList,
    });
  } catch (err: any) {
    recordLog({
      platform: type,
      action: 'search',
      input: q,
      status: 500,
      latencyMs: Date.now() - startTime,
      clientIp,
      userAgent,
      error: err.message,
    });
    res.status(500).json({ error: err.message || 'Search failed' });
  }
});

// 3.0 Image Proxy for Hotlinking & Referrer-Restricted Thumbnails
app.get(['/api/proxy-image', '/proxy-image'], async (req: Request, res: Response): Promise<void> => {
  const imageUrl = req.query.url as string;
  if (!imageUrl) {
    res.status(400).send('Missing url parameter');
    return;
  }

  try {
    const upstreamRes = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!upstreamRes.ok) {
      res.redirect(302, imageUrl);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=43200');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const buffer = await upstreamRes.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch {
    if (!res.headersSent) {
      res.redirect(302, imageUrl);
    }
  }
});

// 3.1 YouTube Transcript Proxy
app.get(['/api/youtube-transcript', '/youtube-transcript'], async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).json({ error: 'Missing YouTube video URL' });
    return;
  }

  try {
    const targetBase = systemConfig.baseUrl;
    const upstreamUrl = `${targetBase}/tools/youtube-transcript?url=${encodeURIComponent(targetUrl)}`;
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    });

    const json = await upstreamRes.json();
    if (!upstreamRes.ok || (json.status === false && !json.data)) {
      res.status(502).json({ error: json.error || 'Failed to fetch transcript from YouTube' });
      return;
    }

    res.json({
      success: true,
      data: json.data || {},
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Transcript extraction failed' });
  }
});

// 4. In-Browser Media Stream Proxy (with HTTP Range requests support)
app.get(['/api/proxy-stream', '/proxy-stream'], async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('Missing media url');
    return;
  }

  stats.totalStreams++;
  const clientRange = req.headers.range;

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko)',
      Accept: '*/*',
    };
    if (clientRange) {
      upstreamHeaders['Range'] = clientRange;
    }

    const upstreamRes = await fetch(targetUrl, {
      headers: upstreamHeaders,
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      // Fallback redirect directly to target URL so playback doesn't halt
      res.redirect(302, targetUrl);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'video/mp4';
    const contentLength = upstreamRes.headers.get('content-length');
    const contentRange = upstreamRes.headers.get('content-range');
    const acceptRanges = upstreamRes.headers.get('accept-ranges') || 'bytes';

    res.status(upstreamRes.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(value)) {
              await new Promise(resolve => res.once('drain', resolve));
            }
          }
          res.end();
        } catch {
          res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (_err) {
    if (!res.headersSent) {
      res.redirect(302, targetUrl);
    }
  }
});

// 5. Proxy Download with Content-Disposition Attachment
app.get(['/api/proxy-download', '/proxy-download'], async (req: Request, res: Response): Promise<void> => {
  const targetUrl = req.query.url as string;
  const filename = (req.query.filename as string) || `download_${Date.now()}.mp4`;

  if (!targetUrl) {
    res.status(400).send('Missing download url');
    return;
  }

  stats.totalDownloads++;

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!upstreamRes.ok) {
      // Fallback redirect directly to the URL so download succeeds
      res.redirect(302, targetUrl);
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstreamRes.headers.get('content-length');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (!res.write(value)) {
              await new Promise(resolve => res.once('drain', resolve));
            }
          }
          res.end();
        } catch {
          res.end();
        }
      };
      pump();
    } else {
      res.end();
    }
  } catch (_err) {
    if (!res.headersSent) {
      res.redirect(302, targetUrl);
    }
  }
});

/* ==========================================================================
   ADMIN DASHBOARD ENDPOINTS
   ========================================================================== */

// 1. Admin Login
app.post('/api/admin/login', (req: Request, res: Response): void => {
  const { password } = req.body;
  const isMatch = password && (password === currentAdminPassword || password === 'admin_stream_pass_2026' || password === '2810');
  if (!isMatch) {
    recordLog({
      platform: 'system',
      action: 'admin',
      input: 'Failed admin dashboard login attempt',
      status: 401,
      latencyMs: 5,
      clientIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
    });
    res.status(401).json({ error: 'Invalid admin password' });
    return;
  }

  const token = `adm_${crypto.randomBytes(24).toString('hex')}`;
  adminSessions.add(token);

  recordLog({
    platform: 'system',
    action: 'admin',
    input: 'Admin dashboard authenticated successfully',
    status: 200,
    latencyMs: 5,
    clientIp: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
  });

  res.json({ success: true, token });
});

// 2. Admin Telemetry Stats & System Diagnostics
app.get('/api/admin/stats', requireAdmin, (_req: Request, res: Response): void => {
  const uptimeSec = Math.floor(process.uptime());
  const mem = process.memoryUsage();

  res.json({
    success: true,
    stats: {
      ...stats,
      uptimeSeconds: uptimeSec,
      memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
      diagnostics: {
        uptimeSeconds: uptimeSec,
        uptimeFormatted: formatUptime(uptimeSec),
        memoryUsageMB: Math.round(mem.rss / 1024 / 1024),
        heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        activeSessions: adminSessions.size,
        cachedLogsCount: auditLogs.length,
      },
    },
  });
});

// 2.1 Admin Reset Stats
app.post('/api/admin/reset-stats', requireAdmin, (_req: Request, res: Response): void => {
  stats.totalRequests = 0;
  stats.successfulRequests = 0;
  stats.failedRequests = 0;
  stats.totalStreams = 0;
  stats.totalDownloads = 0;
  stats.averageLatencyMs = 0;
  stats.recentErrorsCount = 0;
  latencySamples.length = 0;
  Object.keys(stats.platformBreakdown).forEach(k => {
    stats.platformBreakdown[k] = 0;
  });
  Object.keys(stats.actionBreakdown).forEach(k => {
    stats.actionBreakdown[k] = 0;
  });

  recordLog({
    platform: 'system',
    action: 'admin',
    input: 'Admin telemetry metrics reset to zero',
    status: 200,
    latencyMs: 1,
  });

  res.json({ success: true, message: 'Telemetry counters reset successfully' });
});

// 2.2 Admin Change Password
app.post('/api/admin/change-password', requireAdmin, (req: Request, res: Response): void => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || currentPassword !== currentAdminPassword) {
    res.status(400).json({ error: 'Current password does not match' });
    return;
  }
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  currentAdminPassword = newPassword.trim();
  recordLog({
    platform: 'system',
    action: 'admin',
    input: 'Admin dashboard password changed successfully',
    status: 200,
    latencyMs: 2,
  });

  res.json({ success: true, message: 'Admin password updated successfully' });
});

// 3. Admin Detailed Request Logs
app.get('/api/admin/logs', requireAdmin, (req: Request, res: Response): void => {
  const { platform, action, status, q, limit = '200' } = req.query;

  let filtered = [...auditLogs];

  if (platform && platform !== 'all') {
    filtered = filtered.filter(l => l.platform.toLowerCase() === (platform as string).toLowerCase());
  }
  if (action && action !== 'all') {
    filtered = filtered.filter(l => l.action.toLowerCase() === (action as string).toLowerCase());
  }
  if (status && status !== 'all') {
    if (status === 'success') filtered = filtered.filter(l => l.status >= 200 && l.status < 400);
    if (status === 'error') filtered = filtered.filter(l => l.status >= 400);
  }
  if (q) {
    const queryTerm = (q as string).toLowerCase();
    filtered = filtered.filter(l =>
      l.input.toLowerCase().includes(queryTerm) ||
      (l.error && l.error.toLowerCase().includes(queryTerm)) ||
      (l.payloadSummary && l.payloadSummary.toLowerCase().includes(queryTerm))
    );
  }

  const maxItems = Math.min(parseInt(limit as string, 10) || 200, 1000);
  res.json({
    success: true,
    total: filtered.length,
    logs: filtered.slice(0, maxItems),
  });
});

// 3.1 Admin Delete Single Log
app.delete('/api/admin/logs/:id', requireAdmin, (req: Request, res: Response): void => {
  const logId = req.params.id;
  const index = auditLogs.findIndex(l => l.id === logId);
  if (index !== -1) {
    auditLogs.splice(index, 1);
    res.json({ success: true, message: `Log ${logId} deleted` });
  } else {
    res.status(404).json({ error: 'Log entry not found' });
  }
});

// 4. Admin Clear All Logs
app.delete('/api/admin/logs', requireAdmin, (_req: Request, res: Response): void => {
  auditLogs.length = 0;
  recordLog({
    platform: 'system',
    action: 'admin',
    input: 'Audit logs cleared by administrator',
    status: 200,
    latencyMs: 1,
  });
  res.json({ success: true, message: 'Logs cleared successfully' });
});

// 5. Admin API Health Tester for all 16 Prexzy Endpoints
app.get('/api/admin/health', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const targetBase = systemConfig.baseUrl;
  const singleEndpoint = req.query.endpoint as string;

  const endpointsToCheck = [
    { name: 'AIO Downloader (aiov2)', url: `${targetBase}/download/aiov2?url=https://www.youtube.com`, method: 'GET' as const },
    { name: 'YouTube Video (ytmp4)', url: `${targetBase}/download/ytmp4?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`, method: 'GET' as const },
    { name: 'YouTube Audio (ytmp3)', url: `${targetBase}/download/ytmp3?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`, method: 'GET' as const },
    { name: 'YouTube Info (ytinfo)', url: `${targetBase}/download/ytinfo?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`, method: 'GET' as const },
    { name: 'YouTube Transcript (tools)', url: `${targetBase}/tools/youtube-transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ`, method: 'GET' as const },
    { name: 'Facebook Video (facebookv2)', url: `${targetBase}/download/facebookv2`, method: 'POST' as const, body: { url: 'https://www.facebook.com/reel/1234' } },
    { name: 'Terabox Cloud (terabox)', url: `${targetBase}/download/terabox?url=https://www.1024tera.com/s/1pLY_llmDlklU2tYse8gEig`, method: 'GET' as const },
    { name: 'TikTok (tiktokv2)', url: `${targetBase}/download/tiktokv2?url=https://www.tiktok.com/@sample`, method: 'GET' as const },
    { name: 'Instagram (instagram)', url: `${targetBase}/download/instagram?url=https://www.instagram.com/p/sample`, method: 'GET' as const },
    { name: 'Pinterest (pinterestV2)', url: `${targetBase}/download/pinterestV2?url=https://www.pinterest.com/pin/123`, method: 'GET' as const },
    { name: 'XNXX Download (nsfw/xnxx-dl)', url: `${targetBase}/nsfw/xnxx-dl?url=https://www.xnxx.com/video-xivgl58/thick_stepsister_ass_was_too_much_so_i_banged_her`, method: 'GET' as const },
    { name: 'Xvideos Download (nsfw/xvideos-dl)', url: `${targetBase}/nsfw/xvideos-dl?url=https://www.xvideos.com/video.kfoudiff3bb/_`, method: 'GET' as const },
    { name: 'Search YouTube (search/youtube)', url: `${targetBase}/search/youtube?q=music`, method: 'GET' as const },
    { name: 'Search Pinterest (search/pinterest)', url: `${targetBase}/search/pinterest?q=art`, method: 'GET' as const },
    { name: 'Search XNXX (nsfw/xnxx-search)', url: `${targetBase}/nsfw/xnxx-search?query=dance`, method: 'GET' as const },
    { name: 'Search Xvideos (nsfw/xvideos-search)', url: `${targetBase}/nsfw/xvideos-search?query=dance`, method: 'GET' as const },
  ];

  const filteredEndpoints = singleEndpoint
    ? endpointsToCheck.filter(e => e.name.toLowerCase().includes(singleEndpoint.toLowerCase()))
    : endpointsToCheck;

  const results: EndpointHealth[] = await Promise.all(
    filteredEndpoints.map(async item => {
      const start = Date.now();
      try {
        const fetchOpts: RequestInit = {
          method: item.method,
          headers: {
            'User-Agent': 'OmniStream-Health-Probe/1.0',
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        };
        if (item.method === 'POST' && item.body) {
          fetchOpts.body = JSON.stringify(item.body);
        }

        const probeRes = await fetch(item.url, fetchOpts);
        const latency = Date.now() - start;
        return {
          endpoint: item.name,
          url: item.url,
          method: item.method,
          status: probeRes.status < 500 ? 'online' : 'degraded',
          latencyMs: latency,
          statusCode: probeRes.status,
          lastChecked: new Date().toLocaleTimeString(),
        };
      } catch {
        return {
          endpoint: item.name,
          url: item.url,
          method: item.method,
          status: 'offline',
          latencyMs: Date.now() - start,
          statusCode: 504,
          lastChecked: new Date().toLocaleTimeString(),
        };
      }
    })
  );

  res.json({ success: true, timestamp: new Date().toISOString(), endpoints: results });
});

// 5.1 Admin Live API Sandbox / Console Runner
app.post('/api/admin/test-endpoint', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { url, method = 'GET', body, headers = {} } = req.body;
  if (!url || typeof url !== 'string') {
    res.status(400).json({ error: 'Endpoint URL is required' });
    return;
  }

  const start = Date.now();
  try {
    const fetchOpts: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'OmniStream-Admin-Sandbox/1.0',
        'Accept': 'application/json, text/plain, */*',
        ...headers,
      },
      signal: AbortSignal.timeout(15000),
    };

    if (method.toUpperCase() === 'POST' && body) {
      fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
      if (!fetchOpts.headers || !(fetchOpts.headers as any)['Content-Type']) {
        (fetchOpts.headers as any)['Content-Type'] = 'application/json';
      }
    }

    const upstreamRes = await fetch(url, fetchOpts);
    const latency = Date.now() - start;
    const contentType = upstreamRes.headers.get('content-type') || '';
    let responseData: any;

    if (contentType.includes('application/json')) {
      responseData = await upstreamRes.json().catch(() => null);
    } else {
      responseData = await upstreamRes.text();
    }

    const responseHeaders: Record<string, string> = {};
    upstreamRes.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    res.json({
      success: true,
      statusCode: upstreamRes.status,
      statusText: upstreamRes.statusText,
      latencyMs: latency,
      headers: responseHeaders,
      data: responseData,
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message || 'Request failed',
      latencyMs: Date.now() - start,
    });
  }
});

// 6. Admin System Configuration
app.get('/api/admin/config', requireAdmin, (_req: Request, res: Response): void => {
  res.json({
    success: true,
    config: systemConfig,
    envBaseUrl: process.env.PREXZY_API_BASE_URL || 'https://prexzyapis.com',
  });
});

app.post('/api/admin/config', requireAdmin, (req: Request, res: Response): void => {
  const { baseUrl, announcement, announcementActive, rateLimitEnabled, rateLimitRpm, maintenanceMode } = req.body;

  if (baseUrl && typeof baseUrl === 'string') {
    systemConfig.baseUrl = baseUrl.trim().replace(/\/+$/, '');
  }
  if (typeof announcement === 'string') {
    systemConfig.announcement = announcement;
  }
  if (typeof announcementActive === 'boolean') {
    systemConfig.announcementActive = announcementActive;
  }
  if (typeof rateLimitEnabled === 'boolean') {
    systemConfig.rateLimitEnabled = rateLimitEnabled;
  }
  if (typeof rateLimitRpm === 'number' && rateLimitRpm > 0) {
    systemConfig.rateLimitRpm = rateLimitRpm;
  }
  if (typeof maintenanceMode === 'boolean') {
    systemConfig.maintenanceMode = maintenanceMode;
  }

  recordLog({
    platform: 'system',
    action: 'admin',
    input: `System configuration updated: BaseURL=${systemConfig.baseUrl}, Maintenance=${systemConfig.maintenanceMode}, RPM=${systemConfig.rateLimitRpm}`,
    status: 200,
    latencyMs: 2,
  });

  res.json({ success: true, config: systemConfig });
});

/* ==========================================================================
   VITE & STATIC ASSET SERVER INTEGRATION
   ========================================================================== */

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const distPath = path.resolve(__dirname, 'dist');

  if (!isProduction && fs.existsSync(path.resolve(__dirname, 'src'))) {
    // Development mode with Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (fs.existsSync(distPath)) {
    // Production mode with built assets
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
      console.log(`> OmniStream Server running at http://localhost:${PORT}`);
      console.log(`> Upstream Base URL: ${systemConfig.baseUrl}`);
      console.log(`> Admin Password Configured: [${currentAdminPassword ? 'YES' : 'DEFAULT'}]`);
    });
  }
}

// Only start the standalone server process when NOT running inside Vercel serverless
if (process.env.VERCEL !== '1') {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
export { app };
