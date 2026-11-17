import React, { useState, useEffect, useMemo } from 'react';
import { PencilSquareIcon as PencilOutlineIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
import { PencilSquareIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useAuth } from '@/side_panel/context/AuthContext';
import { UnitForm } from '@/side_panel/components/UnitForm';
import { BottomPageSection, DirectoryFolder } from '@/side_panel/components/StackedDirectory';
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

    const filterLabelUnits = (units: any[]) =>
        (units || [])
            .filter((u: any) => !['user_highlight', 'canonical_answer', 'link_subject', 'link_object'].includes(u.unit_type))
            .map((u: any) => ({
                id: u.id,
                text_content: (u.text_content || '').replace(/\s+/g, ' ').substring(0, 100),
                unit_type: u.unit_type,
                author: u.author,
                source_code: u.source_code,
                source_page_id: u.source_page_id,
                title: u.title,
                connected_anchors: u.connected_anchors || []
            }));

    const fetchStats = async (retryCount = 0) => {
        // Don't fetch if we are in the middle of creating/editing
        if (currentSelection || selectedUnit) return;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab?.id) return;

            const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHED_STATS' }).catch(() => null);
            
            // CRITICAL CHANGE: For MediaWiki pages, query the API directly once source_code + source_page_id are scraped;
            // for Bahai.org ('lib'), wait until highlighter.ts finishes its anchor batch load (`res.loaded`).
            if (res && res.source_code && res.source_code !== 'lib' && res.source_page_id) {
                const apiUnits = await get(`/api/units?source_code=${encodeURIComponent(res.source_code)}&source_page_id=${encodeURIComponent(String(res.source_page_id))}`);
                if (isMounted) {
                    setPageUnits(filterLabelUnits(apiUnits));
                }
                return; // Success
            }

            if (res && res.source_code === 'lib' && res.loaded) {
                if (isMounted) {
                    setPageUnits(filterLabelUnits(res.units));
                }
                return; // Success
            }

            // Retry Logic: 250ms delay, max 10 tries
            if (retryCount < 10 && isMounted) {
                setTimeout(() => fetchStats(retryCount + 1), 250);
            } else if (isMounted) {
                setPageUnits([]); // Give up
            }
        } catch (e) { 
            if (isMounted) setPageUnits([]);
        }
    };
    
    fetchStats();

    const handleRuntimeMsg = (msg: any) => {
        if (msg.type === 'PAGE_UNITS_UPDATED') {
            fetchStats();
        }
    };
    chrome.runtime.onMessage.addListener(handleRuntimeMsg);

    return () => {
        isMounted = false;
        chrome.runtime.onMessage.removeListener(handleRuntimeMsg);
    };
  }, [refreshTrigger, workspaceKey, listRefreshKey]);

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
              <div className="flex justify-between items-center pr-20">
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
        <div className="flex justify-between items-center pr-20">
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
        <div className="flex justify-between items-center pr-20">
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
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-10 space-y-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex bg-slate-100 p-1 rounded-lg mr-20 dark:bg-slate-800">
                <div className="flex-1 flex items-center justify-center py-1.5 text-xs font-semibold rounded-md bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400">
                    <PencilSquareIcon className="w-3 h-3 mr-1" />
                    All Labeled Items ({allUnits.length})
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Filter by work, author, type, or text..."
                        value={filterText}
                        onChange={(e) => setFilterText(e.target.value)}
                        className="w-full pl-8 pr-2 py-2 text-sm border rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 dark:focus:bg-slate-950"
                    />
                </div>
            </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
            <div className="pb-10 px-2">
                {loadingAll ? (
                    <div className="p-4 text-xs text-slate-400">Loading...</div>
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
                                    <div
                                        key={unit.id}
                                        onClick={() => handleUnitJump(unit)}
                                        className="ml-3 py-1.5 px-2 cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 text-xs"
                                    >
                                        <div className="flex items-center text-slate-600 dark:text-slate-300 truncate">
                                            <span className="w-3 inline-block flex-shrink-0 mr-1.5 opacity-50 text-[10px]">📄</span>
                                            <span className="truncate font-serif italic">"{unit.text_content}"</span>
                                        </div>
                                        <div className="pl-4 text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                            {unit.author || 'Unknown'} • {capitalize(unit.unit_type)}
                                            {unit._subTitle ? ` • ${unit._subTitle}` : ''}
                                        </div>
                                    </div>
                                ))}
                            </DirectoryFolder>
                        );
                    })
                ) : allUnits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                        <PencilOutlineIcon className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-xs leading-relaxed">
                            This tab could be used to highlight a tablet from ‘Abdu’l-Bahá in Star of the West or letter from the Guardian in Bahá’í News.
                        </p>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                        No matching items found.
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Page Summary */}
        {pageUnits.length > 0 && (
            <BottomPageSection
                label={`This page contains: ${pageUnits.length} Unit${pageUnits.length !== 1 ? 's' : ''}`}
            >
                {pageUnits.map(unit => (
                    <button 
                        key={unit.id}
                        onClick={() => handleUnitJump(unit)}
                        className="w-full text-left py-1.5 px-2 rounded hover:bg-slate-100 transition-colors group flex flex-col gap-0.5 dark:hover:bg-slate-800"
                    >
                        <div className="flex items-start gap-2">
                            <DocumentTextIcon className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0 group-hover:text-blue-600" />
                            <span className="text-xs text-slate-600 font-serif italic line-clamp-2 group-hover:text-slate-800 break-words dark:text-slate-300 dark:group-hover:text-slate-100">
                                "{unit.text_content}"
                            </span>
                        </div>
                        {/* CLEAN METADATA LINE */}
                        <div className="pl-5 text-[10px] text-slate-400 group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-400">
                            Author: {unit.author || 'Unknown'}
                            <span className="mx-1">•</span>
                            Type: {capitalize(unit.unit_type)}
                        </div>
                    </button>
                ))}
            </BottomPageSection>
        )}
    </div>
  );
};
