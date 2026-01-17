import React, { useState, useEffect } from 'react';
import { PencilSquareIcon, QuestionMarkCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { UnitForm } from '@/side_panel/components/UnitForm';
import { useApi } from '@/hooks/useApi';
import { LogicalUnit } from '@/utils/types';

export const Label = () => {
  const { currentSelection, selectedUnit, clearSelection } = useSelection();
  const { get } = useApi();
  
  // State to hold a unit that is being repaired.
  // This persists even if the user selects new text (which clears selectedUnit).
  const [repairTarget, setRepairTarget] = useState<LogicalUnit | null>(null);
  
  // Stats
  const [pageStats, setPageStats] = useState<{count: number, snippet: string} | null>(null);

  // Sync selectedUnit to repairTarget when entering edit mode normally
  // But DO NOT clear repairTarget if selectedUnit becomes null (which happens when selecting text)
  useEffect(() => {
    if (selectedUnit) {
        setRepairTarget(null); // Reset repair state if we click a new unit normally
    }
  }, [selectedUnit]);

  // Fetch Page Stats (Count of units)
  // FETCH STATS
  useEffect(() => {
    const fetchStats = async () => {
        // Only run in Idle state
        if (!currentSelection && !selectedUnit) {
            try {
                // 1. Get Active Tab
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (!tabs[0]?.id) return;

                // 2. Ask Content Script for Page Metadata (Source/ID)
                const meta = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PAGE_METADATA' }).catch(() => null);
                
                if (meta && meta.source_page_id) {
                     // 3. Query API for units on this page
                     const units = await get(`/api/units?source_page_id=${meta.source_page_id}`);
                     if (units && units.length > 0) {
                         setPageStats({
                             count: units.length,
                             snippet: units[0].text_content
                         });
                     } else {
                         setPageStats({ count: 0, snippet: '' });
                     }
                }
            } catch (e) { 
                console.log("Could not fetch page stats", e);
            }
        }
    };
    fetchStats();
  }, [currentSelection, selectedUnit]);

  const handleSuccess = () => {
      clearSelection();
      setRepairTarget(null);
      chrome.tabs.reload();
  };

  const handleCancel = () => {
      clearSelection();
      setRepairTarget(null);
  };

  // RENDER LOGIC
  
  // 1. Repair Mode (Overrides everything else)
  // If we have a repair target, we render the form in "Repair Mode".
  // We pass 'currentSelection' (if exists) as the NEW text to use.
  if (repairTarget) {
      return (
          <div className="p-4">
              <Header title="Repair Unit" />
              <UnitForm 
                  existingUnit={repairTarget}
                  isRepairing={true}
                  selection={currentSelection?.text}
                  offsets={currentSelection?.offsets}
                  connected_anchors={currentSelection?.connected_anchors}
                  onCancel={handleCancel}
                  onSuccess={handleSuccess}
              />
          </div>
      );
  }

  // 2. Edit Mode (Normal)
  if (selectedUnit) {
    return (
      <div className="p-4">
        <Header title="Edit Unit" />
        <UnitForm 
          existingUnit={selectedUnit}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
          onEnterRepair={() => setRepairTarget(selectedUnit)}
        />
      </div>
    );
  }

  // 3. Create Mode
  if (currentSelection) {
    console.log("[Label] Rendering UnitForm. Context anchors:", currentSelection.connected_anchors);
    return (
      <div className="p-4">
        <Header title="New Addition" />
        <UnitForm 
          selection={currentSelection.text}
          offsets={currentSelection.offsets}
          context={currentSelection.context}
          connected_anchors={currentSelection.connected_anchors}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
        />
      </div>
    );
  }

  // 4. Idle State
  return (
    <div className="flex flex-col h-full bg-slate-50">
        
        {/* HEADER (Matched to Q&A Page) */}
        <div className="p-4 bg-white border-b border-slate-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 group relative">
                    <h2 className="text-lg font-bold text-slate-800">
                        Label Manager
                    </h2>
                    <QuestionMarkCircleIcon className="w-5 h-5 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
                    
                    {/* Tooltip */}
                    <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs font-normal rounded-md shadow-xl z-20 leading-relaxed">
                        <p className="font-bold mb-1 border-b border-slate-600 pb-1">How to use this page:</p>
                        <p>Highlight a tablet, prayer, or historical account to label it. This allows the RAG system to understand the specific <em>type</em> of content.</p>
                        <div className="absolute bottom-full left-6 border-8 border-transparent border-b-slate-800"></div>
                    </div>
                </div>
            </div>

            {/* STATS SECTION (Requested Feature) */}
            {pageStats && pageStats.count > 0 && (
                <div className="bg-blue-50 rounded border border-blue-100 p-3 animate-in fade-in duration-500">
                    <p className="text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">
                        This page contains: {pageStats.count} Unit{pageStats.count !== 1 ? 's' : ''}
                    </p>
                    <div className="flex items-start gap-2 opacity-75">
                         <DocumentTextIcon className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                         <span className="text-xs text-blue-900 font-serif italic line-clamp-2">
                             "{pageStats.snippet}"
                         </span>
                    </div>
                </div>
            )}
        </div>
        
        {/* EMPTY STATE PLACEHOLDER */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <PencilSquareIcon className="h-12 w-12 mb-2 opacity-20" /> 
            <p className="text-sm max-w-xs">
                Select text on the page to begin labeling a new logical unit.
            </p>
        </div>
    </div>
  );
};

// Subcomponent for consistent Headers + Tooltips
const Header = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 group relative mb-4">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {title}
        </h2>
        <QuestionMarkCircleIcon className="w-4 h-4 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
        
        {/* Tooltip */}
        <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-64 p-3 bg-slate-800 text-white text-xs font-normal rounded-md shadow-xl z-20 leading-relaxed">
        <p className="font-bold mb-1 border-b border-slate-600 pb-1">Labeling Content</p>
        <p>Use this tab to define logical units of text (Tablets, Prayers, Talks) within the page. This metadata is crucial for the AI to understand the *type* of content it is reading.</p>
        {/* Tooltip Arrow */}
        <div className="absolute bottom-full left-10 border-4 border-transparent border-b-slate-800"></div>
        </div>
    </div>
);
