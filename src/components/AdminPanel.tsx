import React, { useState, useEffect, useRef } from 'react';
import {
  Shield,
  KeyRound,
  Activity,
  FileText,
  Settings,
  RefreshCw,
  Trash2,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  EyeOff,
  LogOut,
  Sliders,
  Server,
  Zap,
  HardDrive,
  Radio,
  Play,
  Copy,
  Check,
  Cpu,
  Clock,
  Send,
  Terminal,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { LogEntry, AdminStats, EndpointHealth, SystemConfig } from '../types';

interface AdminPanelProps {
  onLoginStateChange?: (isLoggedIn: boolean) => void;
}

type AdminTab = 'overview' | 'logs' | 'sandbox' | 'health' | 'config';

const DEFAULT_SANDBOX_PRESETS = [
  {
    name: 'YouTube Video (ytmp4)',
    url: 'https://prexzyapis.com/download/ytmp4?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    method: 'GET',
    body: '',
  },
  {
    name: 'YouTube Audio (ytmp3)',
    url: 'https://prexzyapis.com/download/ytmp3?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    method: 'GET',
    body: '',
  },
  {
    name: 'YouTube Transcript',
    url: 'https://prexzyapis.com/tools/youtube-transcript?url=https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    method: 'GET',
    body: '',
  },
  {
    name: 'Facebook Video (facebookv2)',
    url: 'https://prexzyapis.com/download/facebookv2',
    method: 'POST',
    body: JSON.stringify({ url: 'https://www.facebook.com/reel/1234' }, null, 2),
  },
  {
    name: 'Terabox Cloud (terabox)',
    url: 'https://prexzyapis.com/download/terabox?url=https://www.1024tera.com/s/1pLY_llmDlklU2tYse8gEig',
    method: 'GET',
    body: '',
  },
  {
    name: 'TikTok Video (tiktokv2)',
    url: 'https://prexzyapis.com/download/tiktokv2?url=https://www.tiktok.com/@sample/video/1',
    method: 'GET',
    body: '',
  },
  {
    name: 'Instagram (instagram)',
    url: 'https://prexzyapis.com/download/instagram?url=https://www.instagram.com/p/sample',
    method: 'GET',
    body: '',
  },
  {
    name: 'Pinterest (pinterestV2)',
    url: 'https://prexzyapis.com/download/pinterestV2?url=https://www.pinterest.com/pin/123',
    method: 'GET',
    body: '',
  },
  {
    name: 'XNXX Download (nsfw/xnxx-dl)',
    url: 'https://prexzyapis.com/nsfw/xnxx-dl?url=https://www.xnxx.com/video-xivgl58/thick_stepsister_ass_was_too_much_so_i_banged_her',
    method: 'GET',
    body: '',
  },
  {
    name: 'Xvideos Download (nsfw/xvideos-dl)',
    url: 'https://prexzyapis.com/nsfw/xvideos-dl?url=https://www.xvideos.com/video.kfoudiff3bb/_',
    method: 'GET',
    body: '',
  },
  {
    name: 'Search YouTube (search/youtube)',
    url: 'https://prexzyapis.com/search/youtube?q=lofi',
    method: 'GET',
    body: '',
  },
  {
    name: 'Search Pinterest (search/pinterest)',
    url: 'https://prexzyapis.com/search/pinterest?q=nature',
    method: 'GET',
    body: '',
  },
  {
    name: 'Search XNXX (nsfw/xnxx-search)',
    url: 'https://prexzyapis.com/nsfw/xnxx-search?query=dance',
    method: 'GET',
    body: '',
  },
  {
    name: 'Search Xvideos (nsfw/xvideos-search)',
    url: 'https://prexzyapis.com/nsfw/xvideos-search?query=dance',
    method: 'GET',
    body: '',
  },
];

export const AdminPanel: React.FC<AdminPanelProps> = ({ onLoginStateChange }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('omni_admin_token'));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Tab
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('overview');

  // Auto-refresh interval (seconds, 0 = off)
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0);

  // Admin Telemetry & Data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [health, setHealth] = useState<EndpointHealth[]>([]);
  const [singleProbing, setSingleProbing] = useState<Record<string, boolean>>({});
  const [config, setConfig] = useState<SystemConfig>({
    baseUrl: 'https://prexzyapis.com',
    announcement: '',
    announcementActive: false,
    rateLimitEnabled: false,
    rateLimitRpm: 60,
    maintenanceMode: false,
  });

  // Log filters & pagination
  const [logPlatform, setLogPlatform] = useState('all');
  const [logAction, setLogAction] = useState('all');
  const [logStatus, setLogStatus] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logLimit, setLogLimit] = useState<number>(100);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [copiedLogJson, setCopiedLogJson] = useState(false);

  // Loading states & Messages
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [configMessage, setConfigMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Change Password State
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');

  // Sandbox State
  const [sandboxUrl, setSandboxUrl] = useState(DEFAULT_SANDBOX_PRESETS[0].url);
  const [sandboxMethod, setSandboxMethod] = useState<'GET' | 'POST'>('GET');
  const [sandboxBody, setSandboxBody] = useState('');
  const [sandboxLoading, setSandboxLoading] = useState(false);
  const [sandboxResult, setSandboxResult] = useState<any | null>(null);
  const [copiedSandbox, setCopiedSandbox] = useState(false);

  // Gracefully handle 401s
  const handleUnauthorized = (message = 'Session expired or invalid token. Please log in again.') => {
    sessionStorage.removeItem('omni_admin_token');
    setToken(null);
    setLoginError(message);
    onLoginStateChange?.(false);
  };

  useEffect(() => {
    if (token) {
      fetchAdminData(token);
      onLoginStateChange?.(true);
    } else {
      onLoginStateChange?.(false);
    }
  }, [token]);

  // Live Auto-Refresh
  useEffect(() => {
    if (!token || autoRefreshSec <= 0) return;
    const interval = setInterval(() => {
      fetchAdminData(token, true);
    }, autoRefreshSec * 1000);
    return () => clearInterval(interval);
  }, [token, autoRefreshSec, logPlatform, logAction, logStatus, logSearch, logLimit]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication rejected');
      }

      sessionStorage.setItem('omni_admin_token', data.token);
      setToken(data.token);
      setPassword('');
      fetchAdminData(data.token);
      onLoginStateChange?.(true);
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('omni_admin_token');
    setToken(null);
    setStats(null);
    setLogs([]);
    setHealth([]);
    onLoginStateChange?.(false);
  };

  const fetchAdminData = async (authToken: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const authHeader = { Authorization: `Bearer ${authToken}` };

      // 1. Stats & Diagnostics
      const statsRes = await fetch('/api/admin/stats', { headers: authHeader });
      if (statsRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // 2. Logs
      fetchLogs(authToken);

      // 3. Config
      const cfgRes = await fetch('/api/admin/config', { headers: authHeader });
      if (cfgRes.status === 401) {
        handleUnauthorized();
        return;
      }
      if (cfgRes.ok) {
        const cfgData = await cfgRes.json();
        setConfig(cfgData.config);
      }
    } catch (err) {
      console.warn('Admin telemetry sync warning:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  const fetchLogs = async (
    authToken = token,
    overrideParams?: { platform?: string; action?: string; status?: string; q?: string; limit?: number }
  ) => {
    if (!authToken) return;
    try {
      const p = overrideParams?.platform ?? logPlatform;
      const a = overrideParams?.action ?? logAction;
      const s = overrideParams?.status ?? logStatus;
      const q = overrideParams?.q ?? logSearch;
      const l = overrideParams?.limit ?? logLimit;

      const queryParams = new URLSearchParams({
        platform: p,
        action: a,
        status: s,
        q,
        limit: String(l),
      });

      const res = await fetch(`/api/admin/logs?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        handleUnauthorized();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.warn('Logs query error:', err);
    }
  };

  const handleResetStats = async () => {
    if (!token) return;
    if (!confirm('Are you sure you want to reset all telemetry counters to zero?')) return;
    try {
      const res = await fetch('/api/admin/reset-stats', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return handleUnauthorized();
      if (res.ok) {
        fetchAdminData(token);
      }
    } catch (err) {
      console.warn('Reset stats error:', err);
    }
  };

  const handleDeleteSingleLog = async (logId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/logs/${encodeURIComponent(logId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return handleUnauthorized();
      if (res.ok) {
        setLogs(prev => prev.filter(l => l.id !== logId));
        if (selectedLog?.id === logId) setSelectedLog(null);
      }
    } catch (err) {
      console.warn('Delete log error:', err);
    }
  };

  const handleClearLogs = async () => {
    if (!token) return;
    if (!confirm('Are you sure you want to permanently clear all audit logs?')) return;
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return handleUnauthorized();
      if (res.ok) {
        setLogs([]);
      }
    } catch (err) {
      console.warn('Clear logs error:', err);
    }
  };

  const runHealthCheck = async (singleEndpointName?: string) => {
    if (!token) return;
    if (singleEndpointName) {
      setSingleProbing(prev => ({ ...prev, [singleEndpointName]: true }));
    } else {
      setIsRefreshing(true);
    }

    try {
      const q = singleEndpointName ? `?endpoint=${encodeURIComponent(singleEndpointName)}` : '';
      const res = await fetch(`/api/admin/health${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return handleUnauthorized();
      if (res.ok) {
        const data = await res.json();
        const incoming: EndpointHealth[] = data.endpoints || [];
        if (singleEndpointName) {
          setHealth(prev => {
            const map = new Map(prev.map(e => [e.endpoint, e]));
            incoming.forEach(inc => map.set(inc.endpoint, inc));
            return Array.from(map.values());
          });
        } else {
          setHealth(incoming);
        }
      }
    } catch (err) {
      console.warn('Health diagnostics error:', err);
    } finally {
      if (singleEndpointName) {
        setSingleProbing(prev => ({ ...prev, [singleEndpointName]: false }));
      } else {
        setIsRefreshing(false);
      }
    }
  };

  const handleRunSandbox = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!token || !sandboxUrl.trim()) return;

    setSandboxLoading(true);
    setSandboxResult(null);

    try {
      let parsedBody: any = undefined;
      if (sandboxMethod === 'POST' && sandboxBody.trim()) {
        try {
          parsedBody = JSON.parse(sandboxBody.trim());
        } catch {
          parsedBody = sandboxBody.trim();
        }
      }

      const res = await fetch('/api/admin/test-endpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: sandboxUrl.trim(),
          method: sandboxMethod,
          body: parsedBody,
        }),
      });

      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      setSandboxResult(data);
    } catch (err: any) {
      setSandboxResult({ success: false, error: err.message });
    } finally {
      setSandboxLoading(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setConfigMessage(null);
    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();
      if (res.ok && data.success) {
        setConfigMessage('System configuration successfully committed.');
        setTimeout(() => setConfigMessage(null), 3500);
      }
    } catch (err: any) {
      setConfigMessage(`Error: ${err.message}`);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setPasswordMessage(null);
    setPasswordError(null);

    if (newPass !== confirmPass) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    if (newPass.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: currentPass,
          newPassword: newPass,
        }),
      });

      if (res.status === 401) return handleUnauthorized();
      const data = await res.json();

      if (res.ok && data.success) {
        setPasswordMessage('Admin password updated successfully. Keep it secure!');
        setCurrentPass('');
        setNewPass('');
        setConfirmPass('');
        setTimeout(() => setPasswordMessage(null), 4000);
      } else {
        setPasswordError(data.error || 'Failed to update password');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating password');
    }
  };

  // Export Logs CSV
  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Timestamp', 'Action', 'Platform', 'Status', 'LatencyMs', 'ClientIp', 'Input', 'Error'];
    const rows = logs.map(l => [
      `"${l.timestamp}"`,
      `"${l.action}"`,
      `"${l.platform}"`,
      l.status,
      l.latencyMs,
      `"${l.clientIp || ''}"`,
      `"${(l.input || '').replace(/"/g, '""')}"`,
      `"${(l.error || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `omnistream_audit_logs_${Date.now()}.csv`;
    link.click();
  };

  // Export Logs JSON
  const handleExportJSON = () => {
    if (logs.length === 0) return;
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `omnistream_audit_logs_${Date.now()}.json`;
    link.click();
  };

  /* --------------------------------------------------------------------------
     1. Login Screen (if unauthenticated)
     -------------------------------------------------------------------------- */
  if (!token) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 sm:p-8 bg-neutral-900/60 border border-neutral-800 rounded-2xl shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Admin Gateway Portal</h1>
          <p className="text-xs text-neutral-400">
            Enter administrative credentials to access real-time system metrics, live API sandboxes, health monitors, and gateway configurations.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-neutral-300">Master Password</label>
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3 top-3 text-neutral-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl pl-9 pr-10 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-neutral-500 hover:text-neutral-300"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] pt-1">
              <span className="text-neutral-500">
                Key: <code className="text-neutral-300 font-mono">2810</code> or <code className="text-neutral-300 font-mono">admin_stream_pass_2026</code>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPassword('2810')}
                  className="text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  Fill (2810)
                </button>
              </div>
            </div>
          </div>

          {loginError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn || !password}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-1.5"
          >
            {isLoggingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                <span>Authorizing...</span>
              </>
            ) : (
              <span>Unlock Admin Center</span>
            )}
          </button>
        </form>
      </div>
    );
  }

  /* --------------------------------------------------------------------------
     2. Authenticated Admin Dashboard
     -------------------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* Top Header & Navigation */}
      <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white tracking-tight">Admin Control Center</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                ONLINE
              </span>
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              Gateway: {config.baseUrl} · Port: 3000
            </p>
          </div>
        </div>

        {/* Tab Switcher & Live Controls */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto">
            {(
              [
                { id: 'overview', label: 'Metrics', icon: Activity },
                { id: 'logs', label: 'Audit Logs', icon: FileText },
                { id: 'sandbox', label: 'API Sandbox', icon: Terminal },
                { id: 'health', label: 'Health Probe', icon: Zap },
                { id: 'config', label: 'Settings', icon: Settings },
              ] as const
            ).map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveAdminTab(t.id);
                    if (t.id === 'health' && health.length === 0) runHealthCheck();
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    activeAdminTab === t.id
                      ? 'bg-neutral-800 text-emerald-400 font-semibold shadow-xs'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Auto Refresh Select */}
          <select
            value={autoRefreshSec}
            onChange={e => setAutoRefreshSec(Number(e.target.value))}
            className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-300 focus:outline-none"
            title="Auto-refresh interval"
          >
            <option value={0}>Auto: Off</option>
            <option value={5}>Auto: 5s</option>
            <option value={10}>Auto: 10s</option>
            <option value={30}>Auto: 30s</option>
          </select>

          {/* Manual Refresh */}
          <button
            onClick={() => fetchAdminData(token)}
            disabled={isRefreshing}
            className="p-2 text-neutral-400 hover:text-white bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 text-neutral-400 hover:text-rose-400 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
            title="Lock & Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------------
          TAB 1: METRICS & SYSTEM DIAGNOSTICS
          -------------------------------------------------------------------------- */}
      {activeAdminTab === 'overview' && stats && (
        <div className="space-y-6">
          {/* Main KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">Total Invocations</span>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
                {stats.totalRequests.toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">Success Rate</span>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {stats.totalRequests > 0
                  ? `${Math.round((stats.successfulRequests / stats.totalRequests) * 100)}%`
                  : '100%'}
              </p>
            </div>

            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">Stream Sessions</span>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-sky-400">
                {stats.totalStreams.toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">Downloads Served</span>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-purple-400">
                {stats.totalDownloads.toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">Mean Latency</span>
              <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-400">
                {stats.averageLatencyMs}ms
              </p>
            </div>

            <div className="p-4 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-1">
              <span className="text-[11px] uppercase tracking-wider text-neutral-400 font-medium">System Uptime</span>
              <p className="text-base sm:text-lg font-bold font-mono tabular-nums text-emerald-400 truncate">
                {stats.diagnostics?.uptimeFormatted || `${Math.floor((stats.uptimeSeconds || 0) / 60)}m`}
              </p>
            </div>
          </div>

          {/* Node.js Process & Host Diagnostics */}
          {stats.diagnostics && (
            <div className="p-5 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-white">Live Node.js Runtime & Memory Telemetry</h2>
                </div>
                <button
                  onClick={handleResetStats}
                  className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors flex items-center gap-1"
                  title="Reset counter metrics to 0"
                >
                  <RotateCcw className="w-3 h-3 text-amber-400" />
                  <span>Reset Counters</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">RSS Memory</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {stats.diagnostics.memoryUsageMB} MB
                  </span>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">Heap (Used / Total)</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {stats.diagnostics.heapUsedMB} / {stats.diagnostics.heapTotalMB} MB
                  </span>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">Node Engine</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {stats.diagnostics.nodeVersion}
                  </span>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">Platform / Arch</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {stats.diagnostics.platform} / {stats.diagnostics.arch}
                  </span>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">Active Sessions</span>
                  <span className="text-sm font-bold font-mono text-sky-400">
                    {stats.diagnostics.activeSessions}
                  </span>
                </div>
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-lg">
                  <span className="text-neutral-500 block text-[11px]">Cached Audit Logs</span>
                  <span className="text-sm font-bold font-mono text-purple-400">
                    {stats.diagnostics.cachedLogsCount}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Platform Distribution & Actions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Platforms Breakdown */}
            <div className="p-5 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-white">Platform Traffic Distribution</h2>
              <div className="space-y-2.5">
                {Object.entries(stats.platformBreakdown).map(([plt, count]) => {
                  const pct = stats.totalRequests > 0 ? Math.round((count / stats.totalRequests) * 100) : 0;
                  return (
                    <div key={plt} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium text-neutral-300">{plt}</span>
                        <span className="font-mono tabular-nums text-neutral-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions Breakdown */}
            <div className="p-5 bg-neutral-900/40 border border-neutral-800 rounded-xl space-y-3">
              <h2 className="text-sm font-semibold text-white">Action Types Distribution</h2>
              <div className="space-y-2.5">
                {Object.entries(stats.actionBreakdown).map(([act, count]) => {
                  const pct = stats.totalRequests > 0 ? Math.round((count / stats.totalRequests) * 100) : 0;
                  return (
                    <div key={act} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="capitalize font-medium text-neutral-300">{act}</span>
                        <span className="font-mono tabular-nums text-neutral-400">
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-teal-400 rounded-full transition-all"
                          style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          TAB 2: AUDIT LOGS EXPLORER
          -------------------------------------------------------------------------- */}
      {activeAdminTab === 'logs' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              {/* Search */}
              <input
                type="text"
                placeholder="Search logs by URL, IP or error payload..."
                value={logSearch}
                onChange={e => setLogSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') fetchLogs(token, { q: logSearch });
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 w-48 sm:w-64 focus:outline-none focus:border-emerald-500"
              />

              {/* Platform Filter */}
              <select
                value={logPlatform}
                onChange={e => {
                  const val = e.target.value;
                  setLogPlatform(val);
                  fetchLogs(token, { platform: val });
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                <option value="all">All Platforms</option>
                <option value="youtube">YouTube</option>
                <option value="terabox">Terabox</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="pinterest">Pinterest</option>
                <option value="xnxx">XNXX</option>
                <option value="xvideos">Xvideos</option>
                <option value="aio">AIO</option>
                <option value="system">System</option>
              </select>

              {/* Action Filter */}
              <select
                value={logAction}
                onChange={e => {
                  const val = e.target.value;
                  setLogAction(val);
                  fetchLogs(token, { action: val });
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                <option value="all">All Actions</option>
                <option value="extract">Extract</option>
                <option value="stream">Stream</option>
                <option value="download">Download</option>
                <option value="search">Search</option>
                <option value="admin">Admin</option>
              </select>

              {/* Status Filter */}
              <select
                value={logStatus}
                onChange={e => {
                  const val = e.target.value;
                  setLogStatus(val);
                  fetchLogs(token, { status: val });
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="success">Success (2xx)</option>
                <option value="error">Errors (4xx/5xx)</option>
              </select>

              {/* Limit selector */}
              <select
                value={logLimit}
                onChange={e => {
                  const val = Number(e.target.value);
                  setLogLimit(val);
                  fetchLogs(token, { limit: val });
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-lg px-2 py-1.5 text-xs text-neutral-400 focus:outline-none"
              >
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={200}>200 rows</option>
                <option value={500}>500 rows</option>
              </select>
            </div>

            {/* Action buttons (Export & Clear) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleExportCSV}
                className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1"
                title="Export logs to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>

              <button
                onClick={handleExportJSON}
                className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 transition-colors flex items-center gap-1"
                title="Export logs to JSON"
              >
                <Download className="w-3.5 h-3.5" />
                <span>JSON</span>
              </button>

              <button
                onClick={handleClearLogs}
                className="px-2.5 py-1 text-xs rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors flex items-center gap-1"
                title="Clear all logs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Logs High-Density Table */}
          <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950/80 text-neutral-400 uppercase tracking-wider text-[11px] font-medium border-b border-neutral-800">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-2">Action</th>
                    <th className="py-2.5 px-2">Platform</th>
                    <th className="py-2.5 px-3">Input Target</th>
                    <th className="py-2.5 px-2 text-center">Status</th>
                    <th className="py-2.5 px-2 text-right">Latency</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-mono text-[11px]">
                  {logs.map(log => {
                    const isErr = log.status >= 400;
                    return (
                      <tr key={log.id} className="hover:bg-neutral-800/40 transition-colors">
                        <td className="py-2 px-3 text-neutral-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>

                        <td className="py-2 px-2">
                          <span className="font-semibold uppercase text-neutral-300">
                            {log.action}
                          </span>
                        </td>

                        <td className="py-2 px-2">
                          <span className="capitalize text-emerald-400 font-medium">
                            {log.platform}
                          </span>
                        </td>

                        <td className="py-2 px-3 text-neutral-200 truncate max-w-xs font-sans">
                          {log.input}
                        </td>

                        <td className="py-2 px-2 text-center">
                          <span
                            className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              isErr
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>

                        <td className="py-2 px-2 text-right text-neutral-400 tabular-nums">
                          {log.latencyMs}ms
                        </td>

                        <td className="py-2 px-3 text-right flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="p-1 text-neutral-400 hover:text-emerald-400 rounded transition-colors"
                            title="Inspect Payload"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSingleLog(log.id)}
                            className="p-1 text-neutral-400 hover:text-rose-400 rounded transition-colors"
                            title="Delete log"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-neutral-500 font-sans">
                        No logs match the current query criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          TAB 3: API SANDBOX & CONSOLE (NEW)
          -------------------------------------------------------------------------- */}
      {activeAdminTab === 'sandbox' && (
        <div className="space-y-5">
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Upstream API Testing Sandbox</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  Execute live requests to any Prexzy endpoint to inspect upstream response codes, latency, headers, and payloads.
                </p>
              </div>

              {/* Presets dropdown */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-neutral-400">Preset:</span>
                <select
                  onChange={e => {
                    const preset = DEFAULT_SANDBOX_PRESETS.find(p => p.name === e.target.value);
                    if (preset) {
                      setSandboxUrl(preset.url);
                      setSandboxMethod(preset.method as 'GET' | 'POST');
                      setSandboxBody(preset.body);
                    }
                  }}
                  className="bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
                >
                  {DEFAULT_SANDBOX_PRESETS.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <form onSubmit={handleRunSandbox} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={sandboxMethod}
                  onChange={e => setSandboxMethod(e.target.value as 'GET' | 'POST')}
                  className="w-full sm:w-28 bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2.5 text-xs font-bold text-emerald-400 focus:outline-none"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>

                <input
                  type="text"
                  required
                  value={sandboxUrl}
                  onChange={e => setSandboxUrl(e.target.value)}
                  placeholder="https://prexzyapis.com/download/..."
                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={sandboxLoading || !sandboxUrl.trim()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 shrink-0"
                >
                  {sandboxLoading ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      <span>Probing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Request</span>
                    </>
                  )}
                </button>
              </div>

              {sandboxMethod === 'POST' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-neutral-300">
                    JSON Request Body (POST payload)
                  </label>
                  <textarea
                    rows={4}
                    value={sandboxBody}
                    onChange={e => setSandboxBody(e.target.value)}
                    placeholder='{"url": "https://..."}'
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </form>

            {/* Sandbox Response Viewer */}
            {sandboxResult && (
              <div className="pt-4 border-t border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                        sandboxResult.statusCode >= 200 && sandboxResult.statusCode < 400
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}
                    >
                      HTTP {sandboxResult.statusCode || 'ERR'} {sandboxResult.statusText || ''}
                    </span>
                    <span className="text-xs font-mono text-neutral-400 tabular-nums">
                      Latency: <span className="text-amber-400 font-bold">{sandboxResult.latencyMs}ms</span>
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(sandboxResult.data || sandboxResult, null, 2));
                      setCopiedSandbox(true);
                      setTimeout(() => setCopiedSandbox(false), 2000);
                    }}
                    className="px-2.5 py-1 text-xs rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition-colors flex items-center gap-1"
                  >
                    {copiedSandbox ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Response</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl overflow-x-auto max-h-96">
                  <pre className="text-xs font-mono text-neutral-300 leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(sandboxResult.data || sandboxResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          TAB 4: HEALTH TESTER (16 ENDPOINTS)
          -------------------------------------------------------------------------- */}
      {activeAdminTab === 'health' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Live API Endpoint Diagnostics</h2>
              <p className="text-xs text-neutral-400">
                Pings upstream Prexzy endpoints to verify latency, availability, and response status codes.
              </p>
            </div>
            <button
              onClick={() => runHealthCheck()}
              disabled={isRefreshing}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Test All 16 Endpoints</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {health.map(ep => {
              const isOk = ep.status === 'online';
              const isDegraded = ep.status === 'degraded';
              const isProbing = singleProbing[ep.endpoint];

              return (
                <div
                  key={ep.endpoint}
                  className="p-3.5 rounded-xl border border-neutral-800 bg-neutral-900/40 flex flex-col justify-between gap-3 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{ep.endpoint}</p>
                      <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
                        <span className="font-bold text-neutral-300">{ep.method}</span>
                        <span aria-hidden="true">·</span>
                        <span className={`tabular-nums font-semibold ${ep.latencyMs < 600 ? 'text-emerald-400' : ep.latencyMs < 1800 ? 'text-amber-400' : 'text-rose-400'}`}>
                          {ep.latencyMs}ms
                        </span>
                        {ep.statusCode && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>HTTP {ep.statusCode}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${
                        isOk
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                          : isDegraded
                          ? 'bg-amber-950 text-amber-400 border border-amber-800'
                          : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {ep.status}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-500 font-mono text-[10px]">
                      Checked {ep.lastChecked || 'Just now'}
                    </span>
                    <button
                      onClick={() => runHealthCheck(ep.endpoint)}
                      disabled={isProbing}
                      className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded text-[10px] font-medium border border-neutral-700 transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${isProbing ? 'animate-spin text-emerald-400' : ''}`} />
                      <span>{isProbing ? 'Checking...' : 'Probe'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          TAB 5: SYSTEM CONFIGURATION & SECURITY
          -------------------------------------------------------------------------- */}
      {activeAdminTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gateway Settings Form */}
          <form onSubmit={handleSaveConfig} className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>Gateway & Traffic Rules</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Configure upstream API base URLs, live announcements, and maintenance modes.
              </p>
            </div>

            {configMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
                {configMessage}
              </div>
            )}

            {/* Base URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-300">
                Upstream Prexzy Base URL
              </label>
              <input
                type="text"
                required
                value={config.baseUrl}
                onChange={e => setConfig({ ...config, baseUrl: e.target.value })}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
              />
              <p className="text-[11px] text-neutral-500">
                Default: <code className="text-neutral-400 font-mono">https://prexzyapis.com</code>
              </p>
            </div>

            {/* Rate Limiting */}
            <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Rate Limiting Gatekeeper</p>
                  <p className="text-[11px] text-neutral-400">
                    Enforces per-client IP request limits to protect downstream bandwidth.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.rateLimitEnabled}
                  onChange={e => setConfig({ ...config, rateLimitEnabled: e.target.checked })}
                  className="rounded bg-neutral-900 border-neutral-700 text-emerald-500"
                />
              </div>

              {config.rateLimitEnabled && (
                <div className="pt-2 flex items-center gap-3">
                  <label className="text-xs text-neutral-400">RPM Threshold:</label>
                  <input
                    type="number"
                    min={10}
                    max={1000}
                    value={config.rateLimitRpm || 60}
                    onChange={e => setConfig({ ...config, rateLimitRpm: Number(e.target.value) })}
                    className="w-24 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono text-white"
                  />
                  <span className="text-[11px] text-neutral-500">requests/min per IP</span>
                </div>
              )}
            </div>

            {/* Announcement Banner */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-neutral-300">
                  Global Visitor Announcement
                </label>
                <label className="flex items-center gap-1.5 text-xs text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.announcementActive}
                    onChange={e => setConfig({ ...config, announcementActive: e.target.checked })}
                    className="rounded bg-neutral-950 border-neutral-700 text-emerald-500"
                  />
                  <span>Display Banner</span>
                </label>
              </div>
              <textarea
                rows={2}
                value={config.announcement}
                onChange={e => setConfig({ ...config, announcement: e.target.value })}
                placeholder="Live announcement banner text shown at the top of the app..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Maintenance Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-xl">
              <div>
                <p className="text-xs font-semibold text-white">System Maintenance Mode</p>
                <p className="text-[11px] text-neutral-400">
                  Suspends extraction gateways and displays maintenance advisory.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.maintenanceMode}
                onChange={e => setConfig({ ...config, maintenanceMode: e.target.checked })}
                className="w-4 h-4 rounded bg-neutral-900 border-neutral-700 text-amber-500 focus:ring-0"
              />
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-lg transition-colors shadow-sm"
            >
              Commit Configuration
            </button>
          </form>

          {/* Change Admin Password Card */}
          <form onSubmit={handleChangePassword} className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <span>Change Admin Password</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Update the master administrator credentials for this deployment session.
              </p>
            </div>

            {passwordMessage && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
                {passwordMessage}
              </div>
            )}

            {passwordError && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-300 text-xs">
                {passwordError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPass}
                  onChange={e => setCurrentPass(e.target.value)}
                  placeholder="Enter current password..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">New Password</label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={e => setNewPass(e.target.value)}
                  placeholder="At least 6 characters..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-300">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPass}
                  onChange={e => setConfirmPass(e.target.value)}
                  placeholder="Repeat new password..."
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs rounded-lg border border-neutral-700 transition-colors shadow-sm"
            >
              Update Password
            </button>
          </form>
        </div>
      )}

      {/* --------------------------------------------------------------------------
          LOG DETAILS MODAL / DRAWER
          -------------------------------------------------------------------------- */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">Audit Log Record Inspector</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-neutral-400">
                <div>
                  <span className="text-neutral-500">ID:</span> <span className="font-mono text-neutral-300">{selectedLog.id}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Status:</span>{' '}
                  <span className={selectedLog.status >= 400 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                    HTTP {selectedLog.status}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">Platform:</span> <span className="text-white capitalize">{selectedLog.platform}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Action:</span> <span className="text-white uppercase">{selectedLog.action}</span>
                </div>
                <div>
                  <span className="text-neutral-500">Latency:</span> <span className="font-mono tabular-nums text-amber-400">{selectedLog.latencyMs}ms</span>
                </div>
                <div>
                  <span className="text-neutral-500">IP:</span> <span className="font-mono text-neutral-300">{selectedLog.clientIp}</span>
                </div>
              </div>

              <div>
                <span className="text-neutral-500">Target Input:</span>
                <p className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-white font-mono break-all mt-1">
                  {selectedLog.input}
                </p>
              </div>

              {selectedLog.error && (
                <div>
                  <span className="text-rose-400">Error Payload:</span>
                  <p className="p-2 bg-rose-950/40 border border-rose-900 rounded-lg text-rose-300 font-mono break-all mt-1">
                    {selectedLog.error}
                  </p>
                </div>
              )}

              {selectedLog.payloadSummary && (
                <div>
                  <span className="text-neutral-500">Payload Summary:</span>
                  <p className="p-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-300 font-mono mt-1">
                    {selectedLog.payloadSummary}
                  </p>
                </div>
              )}

              {/* Raw JSON viewer */}
              <div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-neutral-500">Raw JSON:</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLog, null, 2));
                      setCopiedLogJson(true);
                      setTimeout(() => setCopiedLogJson(false), 2000);
                    }}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    {copiedLogJson ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedLogJson ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-[10px] font-mono text-neutral-300 overflow-x-auto max-h-36">
                  {JSON.stringify(selectedLog, null, 2)}
                </pre>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-neutral-800">
              <button
                onClick={() => handleDeleteSingleLog(selectedLog.id)}
                className="px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Log</span>
              </button>

              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
