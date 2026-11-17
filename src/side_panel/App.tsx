import React, { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthGate } from './components/AuthGate';
import { MainLayout } from './components/Layout/MainLayout';
import { SelectionProvider } from './context/SelectionContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Tags } from './features/Tags';
import { Label } from './features/Label';
import { RelationshipManager } from './features/RelationshipManager';
import { QAManager } from './features/QAManager';
import { HelpPage } from './features/HelpPage';

const AppRoutes = () => {
  const { showLogin, closeLogin } = useAuth();

  if (showLogin) {
    return <AuthGate onLogin={closeLogin} onCancel={closeLogin} />;
  }

  return (
    <SelectionProvider>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Tags />} />
          <Route path="label" element={<Label />} />
          <Route path="qa" element={<QAManager />} />
          <Route path="relations" element={<RelationshipManager />} />
          <Route path="help" element={<HelpPage />} />
        </Route>
      </Routes>
    </SelectionProvider>
  );
};

export default function App() {
  useEffect(() => {
    const applyTheme = (theme: 'dark' | 'light') => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    };

    // 1. Initial check on load
    chrome.storage.local.get(['theme'], (result) => {
      if (result.theme === 'dark' || result.theme === 'light') {
        applyTheme(result.theme);
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = prefersDark ? 'dark' : 'light';
        applyTheme(initialTheme);
        chrome.storage.local.set({ theme: initialTheme });
      }
    });

    // 2. Listen for theme changes
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local') {
        if (changes.theme && (changes.theme.newValue === 'dark' || changes.theme.newValue === 'light')) {
          applyTheme(changes.theme.newValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
