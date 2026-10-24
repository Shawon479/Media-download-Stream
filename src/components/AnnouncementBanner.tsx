import React, { useEffect, useState } from 'react';
import { Megaphone, X, AlertTriangle } from 'lucide-react';

export const AnnouncementBanner: React.FC = () => {
  const [data, setData] = useState<{ active: boolean; message: string; maintenanceMode?: boolean }>({
    active: false,
    message: '',
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch('/api/announcement')
      .then(res => res.json())
      .then(resData => {
        if (resData.active && resData.message) {
          setData(resData);
        }
      })
      .catch(() => {});
  }, []);

  if (!data.active || !data.message || dismissed) return null;

  return (
    <div className={`px-4 py-2 text-xs sm:text-sm font-medium border-b flex items-center justify-between gap-3 ${
      data.maintenanceMode
        ? 'bg-amber-950/80 border-amber-800 text-amber-200'
        : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
    }`}>
      <div className="flex items-center gap-2 max-w-5xl mx-auto truncate">
        {data.maintenanceMode ? (
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
        ) : (
          <Megaphone className="w-4 h-4 shrink-0 text-emerald-400" />
        )}
        <span className="truncate">{data.message}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss announcement"
        className="p-1 hover:bg-neutral-800/50 rounded transition-colors text-neutral-400 hover:text-white"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
