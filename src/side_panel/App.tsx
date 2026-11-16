import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { MainLayout } from './components/Layout/MainLayout';
import { SelectionProvider } from './context/SelectionContext';
import { Tags } from './features/Tags';
import { Label } from './features/Label';
import { RelationshipManager } from './features/RelationshipManager';
import { QAManager } from './features/QAManager';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const applyTheme = (theme: 'dark' | 'light') => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    };

    // 1. Initial check on load
    chrome.storage.local.get(['api_token', 'theme'], (result) => {
      if (result.api_token) setIsAuthenticated(true);

      if (result.theme === 'dark' || result.theme === 'light') {
        applyTheme(result.theme);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = prefersDark ? 'dark' : 'light';
        applyTheme(initialTheme);
        chrome.storage.local.set({ theme: initialTheme });
      }
    });

    // 2. Listen for token removal (triggered by 403 errors in useApi)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.api_token) {
          if (!changes.api_token.newValue) {
            setIsAuthenticated(false);
          } else {
            setIsAuthenticated(true);
          }
        }
        if (changes.theme && (changes.theme.newValue === 'dark' || changes.theme.newValue === 'light')) {
          applyTheme(changes.theme.newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  if (!isAuthenticated) {
    return <AuthGate onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <SelectionProvider>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Tags />} />
          <Route path="label" element={<Label />} />
          <Route path="qa" element={<QAManager />} />
          <Route path="relations" element={<RelationshipManager />} />
        </Route>
      </Routes>
    </SelectionProvider>
  );
}
