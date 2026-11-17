import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  PencilSquareIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
  TagIcon,
  SunIcon,
  MoonIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  UserCircleIcon,
  EyeIcon
} from '@heroicons/react/24/solid';
import { useAuth } from '@/side_panel/context/AuthContext';

export const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isAuthenticated,
    userInfo,
    showcaseMode,
    isShowcaseOwner,
    isReadOnly,
    openLogin,
    setShowcaseMode,
    logout
  } = useAuth();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chrome.storage.local.get(['theme'], (res) => {
      if (res.theme) setIsDark(res.theme === 'dark');
    });

    const handleStorage = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
      if (area === 'local' && changes.theme) {
        setIsDark(changes.theme.newValue === 'dark');
      }
    };

    chrome.storage.onChanged.addListener(handleStorage);
    return () => chrome.storage.onChanged.removeListener(handleStorage);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    if (settingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [settingsOpen]);

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    chrome.storage.local.set({ theme: nextTheme });
  };

  // --- NEW: Broadcast Tab Change to Content Script ---
  useEffect(() => {
    const getMode = (path: string) => {
      switch (path) {
        case '/': return 'TAXONOMY_MODE';
        case '/label': return 'CREATE_MODE';
        case '/qa': return 'QA_MODE';
        case '/relations': return 'RELATIONS_MODE';
        default: return 'TAXONOMY_MODE';
      }
    };

    const mode = getMode(location.pathname);
    chrome.storage.local.set({ highlightMode: mode });

  }, [location.pathname]);

  const getTabClass = (path: string) => 
    location.pathname === path 
      ? "text-blue-600" 
      : "text-gray-400 hover:text-gray-600";

  return (
    <div className="relative flex flex-col h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <div ref={settingsRef} className="fixed top-3 right-3 z-50">
        <button
          onClick={() => setSettingsOpen(prev => !prev)}
          title="Settings & Account"
          className="relative p-2 rounded-full bg-white/90 dark:bg-slate-800/90 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 shadow-sm transition-colors"
        >
          <Cog6ToothIcon className="h-4 w-4" />
          {isReadOnly && (
            <span
              title="Viewing Sample Data (Read-Only)"
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white dark:ring-slate-900"
            />
          )}
        </button>

        {settingsOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-3 space-y-3 text-xs">
            {!isAuthenticated ? (
              <div className="space-y-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                  <EyeIcon className="w-4 h-4 flex-shrink-0" />
                  <span>Sample Data (Read-Only)</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Exploring the sample collection. Log in with a Bahai.works bot password to start your own.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    openLogin();
                  }}
                  className="w-full py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded shadow-sm transition-colors"
                >
                  Log In
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 pb-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200 truncate">
                  <UserCircleIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="truncate">{userInfo?.username || 'Logged In'}</span>
                </div>

                {!isShowcaseOwner && (
                  <div className="space-y-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Active View
                    </span>
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-md">
                      <button
                        type="button"
                        onClick={() => setShowcaseMode(false)}
                        className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
                          !showcaseMode
                            ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        My Data
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowcaseMode(true)}
                        className={`flex-1 py-1 px-2 rounded text-[11px] font-semibold transition-colors ${
                          showcaseMode
                            ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-400'
                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                        }`}
                      >
                        Sample (Read-Only)
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={async () => {
                    setSettingsOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors font-medium"
                >
                  <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="w-full flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <span className="font-medium">Appearance</span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                {isDark ? (
                  <>
                    <MoonIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dark</span>
                  </>
                ) : (
                  <>
                    <SunIcon className="w-3.5 h-3.5 text-amber-500" />
                    <span>Light</span>
                  </>
                )}
              </span>
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-16">
        <Outlet />
      </div>

      <div className="fixed bottom-0 w-full h-14 bg-white border-t border-slate-200 flex justify-around items-center shadow-lg z-50 dark:bg-slate-900 dark:border-slate-800">

        <button onClick={() => navigate('/')} className={`flex flex-col items-center p-2 w-full ${getTabClass('/')}`}>
          <TagIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Tags</span>
        </button>

        <button onClick={() => navigate('/label')} className={`flex flex-col items-center p-2 w-full ${getTabClass('/label')}`}>
          <PencilSquareIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Label</span>
        </button>

        <button onClick={() => navigate('/qa')} className={`flex flex-col items-center p-2 w-full ${getTabClass('/qa')}`}>
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Q&A</span>
        </button>

        <button onClick={() => navigate('/relations')} className={`flex flex-col items-center p-2 w-full ${getTabClass('/relations')}`}>
          <LinkIcon className="h-6 w-6" />
          <span className="text-[10px] font-medium">Link</span>
        </button>

      </div>
    </div>
  );
};
