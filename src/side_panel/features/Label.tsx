import React, { useState, useEffect, useMemo } from 'react';
import { PencilSquareIcon, QuestionMarkCircleIcon, DocumentTextIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useAuth } from '@/side_panel/context/AuthContext';
import { UnitForm } from '@/side_panel/components/UnitForm';
import { PinnedPageSection, DirectoryFolder } from '@/side_panel/components/StackedDirectory';
import { useApi } from '@/hooks/useApi';
import { LogicalUnit } from '@/utils/types';

export const Label = () => {
  // 1. Destructure refreshTrigger
  const { currentSelection, selectedUnit, clearSelection, refreshTrigger } = useSelection();
  const { isReadOnly, workspaceKey } = useAuth();
  const { get } = useApi();

  const [repairTarget, setRepairTarget] = useState<LogicalUnit | null>(null);
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const [pageUnits, setPageUnits] = useState<{
      id: number,
      text_content: string,
      unit_type: string,
      author?: string,
      source_code: string,
      source_page_id: number,
      title?: string,
      connected_anchors?: number[]
  }[]>([]);

  useEffect(() => {
    if (selectedUnit) {
        setRepairTarget(null); 
    }
  }, [selectedUnit]);

  // 2. Refactored Fetch Logic with Retry
  useEffect(() => {
    let isMounted = true;
    
    // Clear OLD data immediately on navigation
    if (!currentSelection && !selectedUnit) {
        setPageUnits([]);
    }

    const fetchStats = async (retryCount = 0) => {
        // Don't fetch if we are in the middle of creating/editing
        if (currentSelection || selectedUnit) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHED_STATS' }).catch(() => null);
            
            // CRITICAL CHANGE: We must verify 'source_code' exists to confirm the scraper 
            // has finished processing the new page.
            const hasContext = res && (res.source_code || (res.units && res.units.length > 0));

            if (hasContext) {
                if (isMounted) {
                    setPageUnits(res.units.filter((u: any) => 
                        !['user_highlight', 'canonical_answer', 'link_subject', 'link_object'].includes(u.unit_type)
                    ));
                }
                return; // Success
            }

            // Retry Logic: 250ms delay, max 8 tries
            if (retryCount < 8 && isMounted) {
                setTimeout(() => fetchStats(retryCount + 1), 250);
            } else if (isMounted) {
                setPageUnits([]); // Give up
            }
        } catch (e) { 
            if (isMounted) setPageUnits([]);
        }
    };
    
    fetchStats();

    return () => { isMounted = false; };
  }, [refreshTrigger, workspaceKey]);

  useEffect(() => {
    let isMounted = true;
    setLoadingAll(true);
    get('/api/units?scope=labels')
      .then((rows) => {
        if (isMounted) setAllUnits(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error("Failed to fetch all labeled units", err);
        if (isMounted) setAllUnits([]);
      })
      .finally(() => {
        if (isMounted) setLoadingAll(false);
      });
    return () => { isMounted = false; };
  }, [workspaceKey, listRefreshKey]);

  const groupedUnits = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const groups = new Map<string, any[]>();

    for (const u of allUnits) {
      const fullTitle = u.title || 'Untitled Source';
      const [rootTitle, ...rest] = fullTitle.split('/');
      const groupName = rootTitle.trim() || 'Other';
      const subTitle = rest.join(' / ').trim();

      if (q) {
        const hay = `${fullTitle} ${u.author || ''} ${u.unit_type || ''} ${u.text_content || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push({ ...u, _subTitle: subTitle });
    }

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allUnits, filterText]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleUnitJump = (unit: typeof pageUnits[0]) => {
      chrome.runtime.sendMessage({ 
          type: 'NAVIGATE_TO_UNIT', 
          unit_id: unit.id,
          source_code: unit.source_code,
          source_page_id: unit.source_page_id,
          title: unit.title,
          connected_anchors: unit.connected_anchors
      });
  };

  const handleSuccess = () => {
      clearSelection();
      setRepairTarget(null);
      setListRefreshKey(prev => prev + 1);
      chrome.tabs.reload();
  };

  const handleCancel = () => {
      clearSelection();
      setRepairTarget(null);
  };

  // Helper to Capitalize First Letter
  const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

  // 1. Repair Mode
  if (repairTarget && !isReadOnly) {
      return (
          <div className="p-4 space-y-6">
              <div className="flex justify-between items-center">
                 <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Repair Unit</h2>
              </div>
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

  // 2. Edit Mode
  if (selectedUnit && !['user_highlight', 'canonical_answer', 'link_subject', 'link_object'].includes(selectedUnit.unit_type)) {
    const canEditUnit = !isReadOnly && (selectedUnit.can_delete ?? true);
    return (
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
               {canEditUnit ? 'Edit Unit' : 'Unit Details'}
             </h2>
        </div>
        <UnitForm 
          existingUnit={selectedUnit}
          readOnly={isReadOnly}
          onCancel={handleCancel}
          onSuccess={handleSuccess}
          onEnterRepair={() => setRepairTarget(selectedUnit)}
        />
      </div>
    );
  }

  // 3. Create Mode
  if (currentSelection && !isReadOnly) {
    return (
      <div className="p-4 space-y-6">
        <div className="flex justify-between items-center">
             <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">New Addition</h2>
        </div>
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
    <div className="p-4 space-y-3 h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center pr-10 flex-shrink-0">
            <div className="flex items-center gap-2 group relative">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Label Manager
                </h2>
                <QuestionMarkCircleIcon className="w-5 h-5 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
                
                <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs font-normal rounded-md shadow-xl z-20 leading-relaxed dark:bg-slate-700">
                    <p className="font-bold mb-1 border-b border-slate-600 pb-1">How to use this page:</p>
                    <p>Highlight a tablet, prayer, or historical account to label it.</p>
                    <div className="absolute bottom-full left-6 border-8 border-transparent border-b-slate-800 dark:border-b-slate-700"></div>
                </div>
            </div>
        </div>

        {pageUnits.length > 0 && (
            <PinnedPageSection
                label={`This page contains: ${pageUnits.length} Unit${pageUnits.length !== 1 ? 's' : ''}`}
                accent="blue"
            >
                {pageUnits.map(unit => (
                    <button 
                        key={unit.id}
                        onClick={() => handleUnitJump(unit)}
                        className="w-full text-left bg-white p-2 rounded border border-blue-100 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group flex flex-col gap-1 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-blue-700"
                    >
                        <div className="flex items-start gap-2">
                            <DocumentTextIcon className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0 group-hover:text-blue-600" />
                            <span className="text-xs text-slate-600 font-serif italic line-clamp-2 group-hover:text-slate-800 break-words dark:text-slate-300 dark:group-hover:text-slate-100">
                                "{unit.text_content}"
                            </span>
                        </div>
                        
                        {/* CLEAN METADATA LINE */}
                        <div className="w-full text-right mt-1 border-t border-slate-50 pt-1 dark:border-slate-800">
                            <span className="text-[10px] text-slate-500 group-hover:text-blue-600 font-medium dark:text-slate-400 dark:group-hover:text-blue-400">
                                Author: {unit.author || 'Unknown'}
                                <span className="mx-1">•</span>
                                Type: {capitalize(unit.unit_type)}
                            </span>
                        </div>
                    </button>
                ))}
            </PinnedPageSection>
        )}
        <div className="flex-1 min-h-0 flex flex-col bg-white rounded border border-slate-200 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <button
                type="button"
                onClick={() => setDirectoryOpen(prev => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800/70 dark:border-slate-800 dark:text-slate-300 flex-shrink-0"
            >
                <span>All Labeled Items ({allUnits.length})</span>
                {directoryOpen ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
            </button>

            {directoryOpen && (
                <>
                    <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                        <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Filter by work, author, type, or text..."
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                                className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                        {loadingAll ? (
                            <div className="p-4 text-center text-xs text-slate-400">Loading items...</div>
                        ) : groupedUnits.length > 0 ? (
                            groupedUnits.map(([groupName, items]) => {
                                const isOpen = Boolean(filterText.trim()) || expandedGroups.has(groupName);
                                return (
                                    <DirectoryFolder
                                        key={groupName}
                                        label={groupName}
                                        count={items.length}
                                        isOpen={isOpen}
                                        onToggle={() => toggleGroup(groupName)}
                                    >
                                        {items.map((unit: any) => (
                                            <button
                                                key={unit.id}
                                                onClick={() => handleUnitJump(unit)}
                                                className="w-full text-left bg-slate-50 hover:bg-blue-50/70 p-2 rounded border border-slate-200/80 hover:border-blue-200 transition-colors flex flex-col gap-1 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-blue-800"
                                            >
                                                {unit._subTitle && (
                                                    <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 truncate">
                                                        {unit._subTitle}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-600 font-serif italic line-clamp-2 dark:text-slate-300">
                                                    "{unit.text_content}"
                                                </span>
                                                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                                    {unit.author || 'Unknown'} • {capitalize(unit.unit_type)}
                                                </span>
                                            </button>
                                        ))}
                                    </DirectoryFolder>
                                );
                            })
                        ) : allUnits.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                                <PencilSquareIcon className="h-10 w-10 mb-2 opacity-20" />
                                <p className="text-xs leading-relaxed">
                                    This tab could be used to highlight a tablet from ‘Abdu’l-Bahá in Star of the West or letter from the Guardian in Bahá’í News.
                                </p>
                            </div>
                        ) : (
                            <div className="p-4 text-center text-xs italic text-slate-400">
                                No matching items found.
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    </div>
  );
};
