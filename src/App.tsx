import React, { useState } from 'react';
import { Header } from './components/Header';
import { AnnouncementBanner } from './components/AnnouncementBanner';
import { StreamDownloader } from './components/StreamDownloader';
import { TeraboxHub } from './components/TeraboxHub';
import { ExploreSearch } from './components/ExploreSearch';
import { AdminPanel } from './components/AdminPanel';
import { PlaySquare } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'downloader' | 'terabox' | 'search' | 'admin'>('downloader');
  const [injectedUrl, setInjectedUrl] = useState<string>('');
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Transition from Search Hub into Downloader
  const handleSelectMediaFromSearch = (url: string) => {
    setInjectedUrl(url);
    if (url.includes('1024tera.com') || url.includes('terabox.com')) {
      setActiveTab('terabox');
    } else {
      setActiveTab('downloader');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-neutral-950">
      {/* Real-time Announcement Banner */}
      <AnnouncementBanner />

      {/* Top Header Navigation (Top Bar Contract) */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isAdminLoggedIn={isAdminLoggedIn}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'downloader' && (
          <StreamDownloader
            key={injectedUrl}
            initialUrl={injectedUrl}
            onNavigateToTerabox={url => {
              setInjectedUrl(url);
              setActiveTab('terabox');
            }}
          />
        )}

        {activeTab === 'terabox' && (
          <TeraboxHub
            key={injectedUrl}
            defaultUrl={injectedUrl || ''}
          />
        )}

        {activeTab === 'search' && (
          <ExploreSearch onSelectMedia={handleSelectMediaFromSearch} />
        )}

        {activeTab === 'admin' && (
          <AdminPanel onLoginStateChange={setIsAdminLoggedIn} />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 mt-12 text-xs text-neutral-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <PlaySquare className="w-3.5 h-3.5 fill-current" />
            </div>
            <span className="font-semibold text-neutral-300">OmniStream Suite</span>
            <span aria-hidden="true">·</span>
            <span>All-In-One Media Engine & Terabox Streamer</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('admin')}
              className="hover:text-emerald-400 transition-colors"
            >
              Admin Dashboard
            </button>
            <span aria-hidden="true">·</span>
            <span>Powered by Prexzy APIs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
