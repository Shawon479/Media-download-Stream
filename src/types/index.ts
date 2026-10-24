/**
 * Universal Media & Admin System Types
 */

export type PlatformType =
  | 'auto'
  | 'youtube'
  | 'terabox'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'pinterest'
  | 'xnxx'
  | 'xvideos'
  | 'aio';

export type MediaType = 'video' | 'audio' | 'image' | 'gallery' | 'folder';

export interface MediaFormat {
  id: string;
  label: string;
  quality?: string;
  resolution?: string;
  extension: string;
  fileSizeBytes?: number;
  fileSizeFormatted?: string;
  url: string;
  directStreamable?: boolean;
  fps?: number;
  formatNote?: string;
}

export interface TeraboxFile {
  fsId: number | string;
  filename: string;
  path: string;
  sizeBytes: number;
  sizeFormatted: string;
  category: 'video' | 'photo' | 'document' | 'other';
  thumbnail?: string;
  streamUrl?: string;
  md5?: string;
}

export interface UniversalMediaItem {
  id: string;
  title: string;
  platform: PlatformType;
  sourceUrl: string;
  thumbnail?: string;
  author?: string;
  channelUrl?: string;
  duration?: string;
  durationSeconds?: number;
  views?: string | number;
  likes?: string | number;
  uploadDate?: string;
  mediaType: MediaType;
  streamUrl?: string;
  streams: MediaFormat[];
  downloads: MediaFormat[];
  description?: string;
  // Specific for Terabox folders
  teraboxData?: {
    shareId: number | string;
    rootPath: string;
    totals: { items: number; folders: number; videos: number; photos: number };
    files: TeraboxFile[];
  };
  // Specific for image galleries
  galleryImages?: string[];
  raw?: unknown;
}

export interface SearchResultItem {
  id: string;
  type: 'youtube' | 'pinterest';
  title: string;
  channel?: string;
  duration?: string;
  imageUrl: string;
  link: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  platform: string;
  action: 'extract' | 'stream' | 'download' | 'search' | 'admin';
  input: string;
  status: number;
  latencyMs: number;
  clientIp?: string;
  userAgent?: string;
  error?: string;
  payloadSummary?: string;
}

export interface DatabaseDiagnostics {
  connected: boolean;
  type: string;
  path: string;
  fileSizeBytes: number;
  totalLogs: number;
  totalMediaHistory: number;
}

export interface ServerDiagnostics {
  uptimeSeconds: number;
  uptimeFormatted: string;
  memoryUsageMB: number;
  heapUsedMB: number;
  heapTotalMB: number;
  nodeVersion: string;
  platform: string;
  arch: string;
  activeSessions: number;
  cachedLogsCount: number;
  database?: DatabaseDiagnostics;
}

export interface AdminStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalStreams: number;
  totalDownloads: number;
  averageLatencyMs: number;
  platformBreakdown: Record<string, number>;
  actionBreakdown: Record<string, number>;
  recentErrorsCount: number;
  uptimeSeconds?: number;
  memoryUsageMB?: number;
  diagnostics?: ServerDiagnostics;
}

export interface EndpointHealth {
  endpoint: string;
  url?: string;
  method: 'GET' | 'POST';
  status: 'online' | 'degraded' | 'offline' | 'checking';
  latencyMs: number;
  statusCode?: number;
  lastChecked?: string;
  sampleResponse?: string;
}

export interface SystemConfig {
  baseUrl: string;
  announcement: string;
  announcementActive: boolean;
  rateLimitEnabled: boolean;
  rateLimitRpm?: number;
  maintenanceMode: boolean;
}

