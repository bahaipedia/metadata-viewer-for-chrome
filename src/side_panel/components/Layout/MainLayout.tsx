import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { PencilSquareIcon, LinkIcon, ChatBubbleLeftRightIcon, TagIcon, SunIcon, MoonIcon } from '@heroicons/react/24/solid';

export const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

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
      <button
        onClick={toggleTheme}
        title={isDark ? "Switch to light mode" : "Switch to dark mode"}
        className="fixed top-3 right-3 z-50 p-2 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-amber-400 shadow-sm transition-colors"
      >
        {isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
      </button>

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
