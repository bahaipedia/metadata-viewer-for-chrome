import React, { useEffect, useState } from 'react';
import { AuthGate } from './components/AuthGate';
import { UnitForm } from './components/UnitForm';
import { PageMetadata } from '@/utils/types';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentSelection, setCurrentSelection] = useState<string | null>(null);
  const [pageContext, setPageContext] = useState<PageMetadata | null>(null);
  // ADD THIS STATE
  const [currentOffsets, setCurrentOffsets] = useState<{start: number; end: number} | null>(null);

  useEffect(() => {
    chrome.storage.local.get(['api_token'], (result) => {
      if (result.api_token) setIsAuthenticated(true);
    });
  }, []);

  useEffect(() => {
    const handleMessage = (request: any) => {
      if (request.type === 'TEXT_SELECTED') {
        setCurrentSelection(request.text);
        setPageContext(request.context);
        // CAPTURE OFFSETS HERE
        setCurrentOffsets(request.offsets); 
      }
      if (request.type === 'SELECTION_CLEARED') {
        setCurrentSelection(null);
        setCurrentOffsets(null);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  if (!isAuthenticated) {
    return <AuthGate onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="p-4 bg-slate-50 min-h-screen text-slate-800">
      <header className="mb-4 border-b border-slate-200 pb-2">
        <h1 className="text-lg font-bold text-slate-900">RAG Librarian</h1>
      </header>

      <main>
        {currentSelection && currentOffsets ? ( // CHECK BOTH
          <UnitForm 
            selection={currentSelection} 
            context={pageContext} 
            offsets={currentOffsets} // PASS IT HERE
            onCancel={() => setCurrentSelection(null)}
          />
        ) : (
          <div className="text-center mt-10 text-slate-400">
            <p className="text-sm">Select text on the page to contribute.</p>
          </div>
        )}
      </main>
    </div>
  );
}
