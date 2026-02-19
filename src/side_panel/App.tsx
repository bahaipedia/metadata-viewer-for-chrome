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
    // 1. Initial check on load
    chrome.storage.local.get(['api_token'], (result) => {
      if (result.api_token) setIsAuthenticated(true);
    });

    // 2. Listen for token removal (triggered by 403 errors in useApi)
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
      if (areaName === 'local' && changes.api_token) {
        if (!changes.api_token.newValue) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(true);
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
