import React from 'react';
import { PlaySquare, Sparkles, Shield, HardDrive, Search } from 'lucide-react';

interface HeaderProps {
  activeTab: 'downloader' | 'terabox' | 'search' | 'admin';
  setActiveTab: (tab: 'downloader' | 'terabox' | 'search' | 'admin') => void;
  isAdminLoggedIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isAdminLoggedIn }) => {
  return (
    <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          onClick={() => setActiveTab('downloader')}
          className="flex items-center gap-2.5 text-left group focus:outline-none"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-neutral-950 shadow-sm transition-transform group-hover:scale-105">
            <PlaySquare className="w-5 h-5 fill-neutral-950" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
              StreamPulse
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links (Single Line) */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('downloader')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'downloader'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Stream & Download
          </button>

          <button
            onClick={() => setActiveTab('terabox')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'terabox'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            Terabox Cloud
          </button>

          <button
            onClick={() => setActiveTab('search')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'search'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900'
            }`}
          >
            <Search className="w-4 h-4" />
            Search Hub
          </button>
        </nav>

        {/* Zone 3: Primary Action (Admin Panel) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-emerald-500 text-neutral-950 shadow-sm'
                : 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500 hover:bg-neutral-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Console</span>
            {isAdminLoggedIn && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-0.5" title="Authenticated" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Strip */}
      <div className="md:hidden flex items-center justify-around border-t border-neutral-800/80 px-2 py-2 bg-neutral-950 overflow-x-auto">
        <button
          onClick={() => setActiveTab('downloader')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'downloader' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
          }`}
        >
          Downloader
        </button>
        <button
          onClick={() => setActiveTab('terabox')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'terabox' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
          }`}
        >
          Terabox
        </button>
        <button
          onClick={() => setActiveTab('search')}
          className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap ${
            activeTab === 'search' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
          }`}
        >
          Search
        </button>
      </div>
    </header>
  );
};
