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
        <div className="p-4 border-b border-slate-200 bg-white shadow-sm">
            <Header title="Label Manager" />
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 space-y-4">
            <div className="bg-slate-100 p-4 rounded-full">
                <PencilSquareIcon className="h-10 w-10 text-slate-300" /> 
            </div>
            
            <div className="space-y-2 max-w-xs">
                <p className="text-sm">
                    Highlight a tablet, prayer, or historical account to label it.
                </p>
                <p className="text-xs text-slate-300">
                    This allows the RAG system to answer queries like: <br/>
                    <span className="italic">"Find all tablets from ‘Abdu’l-Bahá in this book"</span>
                </p>
            </div>

            {pageStats && (
                <div className="mt-8 pt-6 border-t border-slate-200 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                        This page contains {pageStats.count} unit{pageStats.count !== 1 ? 's' : ''}
                    </p>
                    <div className="bg-white p-3 rounded border border-slate-200 text-left shadow-sm opacity-80 hover:opacity-100 transition-opacity cursor-default">
                        <div className="flex items-start gap-2">
                            <DocumentTextIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <span className="text-xs text-slate-600 font-serif italic">
                                "{pageStats.snippet}"
                            </span>
                        </div>
                    </div>
                </div>
            )}
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
