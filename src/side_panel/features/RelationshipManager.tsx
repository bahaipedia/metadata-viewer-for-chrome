import React, { useState, useEffect, useMemo } from 'react';
import { LinkIcon as LinkOutlineIcon, ArrowsUpDownIcon } from '@heroicons/react/24/outline';
import { LinkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useAuth } from '@/side_panel/context/AuthContext';
import { BottomPageSection, DirectoryFolder } from '@/side_panel/components/StackedDirectory';
import { useApi } from '@/hooks/useApi';
import { StagedItem } from '@/utils/types';

const AUTHOR_OPTIONS = [
  "Bahá’u’lláh",
  "The Báb",
  "‘Abdu’l-Bahá",
  "Shoghi Effendi",
  "Universal House of Justice",
  "Other"
];

export const RelationshipManager = () => {
  const { currentSelection, selectedUnit, clearSelection, refreshTrigger } = useSelection();
  const { isReadOnly, workspaceKey } = useAuth();
  const { post, get, del } = useApi();
  const [subject, setSubject] = useState<StagedItem | null>(null);
  const [object, setObject] = useState<StagedItem | null>(null);
  const [subjectAuthor, setSubjectAuthor] = useState('Other');
  const [objectAuthor, setObjectAuthor] = useState('Other');
  const [relType, setRelType] = useState('commentary');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [relationships, setRelationships] = useState<any[]>([]);
  const [allRelationships, setAllRelationships] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [currentPageId, setCurrentPageId] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;

    // 1. Clear IMMEDIATELY when navigation is detected
    // This removes the "stale" data instantly while we wait for the new page to load.
    setRelationships([]);

    const fetchStats = async (retryCount = 0) => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      try {
        const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHED_STATS' }).catch(() => null);
        
        const pageSourceCode = res?.source_code || res?.units?.[0]?.source_code;
        const pageSourcePageId = res?.source_page_id || res?.units?.[0]?.source_page_id;
        const pageUnitIds = Array.isArray(res?.units)
          ? res.units.map((u: any) => u.id).filter(Boolean).join(',')
          : '';

        if ((pageSourceCode && pageSourcePageId) || pageUnitIds) {
            const params = new URLSearchParams();
            if (pageSourceCode && pageSourcePageId) {
              params.set('source_code', String(pageSourceCode));
              params.set('source_page_id', String(pageSourcePageId));
            }
            if (pageUnitIds) {
              params.set('unit_ids', pageUnitIds);
            }
            const rels = await get(`/api/relationships?${params.toString()}`);
            if (isMounted) setRelationships(rels || []);
            return; 
        }

        // 2. Retry Logic: 250ms delay, give up after 2 seconds (8 retries)
        if (retryCount < 8 && isMounted) {
            setTimeout(() => fetchStats(retryCount + 1), 250); 
        } else if (isMounted) {
            setRelationships([]); // Ensure empty if finally failed
        }

      } catch (e) {
        console.error("Failed to fetch relationships", e);
        if (isMounted) setRelationships([]);
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
    get('/api/relationships?scope=all')
      .then((rows) => {
        if (isMounted) setAllRelationships(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error("Failed to fetch all relationships", err);
        if (isMounted) setAllRelationships([]);
      })
      .finally(() => {
        if (isMounted) setLoadingAll(false);
      });
    return () => { isMounted = false; };
  }, [workspaceKey, listRefreshKey]);

  useEffect(() => {
    if (isReadOnly && (subject || object)) {
      setSubject(null);
      setObject(null);
    }
  }, [isReadOnly]);

  // --- STANDARD HELPERS (State Persistence, etc.) ---
  useEffect(() => {
    chrome.storage.local.get(['linkerState'], (result) => {
      if (result.linkerState) {
        setSubject(result.linkerState.subject);
        setObject(result.linkerState.object);
        setRelType(result.linkerState.relType || 'commentary');
        setSubjectAuthor(result.linkerState.subjectAuthor || 'Other');
        setObjectAuthor(result.linkerState.objectAuthor || 'Other');
      }
    });
  }, []);

  const updateState = (
    key: 'subject' | 'object' | 'relType' | 'subjectAuthor' | 'objectAuthor' | 'clear', 
    value: any
  ) => {
    if (key === 'clear') {
      setSubject(null);
      setObject(null);
      setSubjectAuthor('Other');
      setObjectAuthor('Other');
      setRelType('commentary');
      chrome.storage.local.remove('linkerState');
      return;
    }

    // React State
    if (key === 'subject') setSubject(value);
    if (key === 'object') setObject(value);
    if (key === 'relType') setRelType(value);
    
    let newSubjectAuthor = subjectAuthor;
    let newObjectAuthor = objectAuthor;

    const isSubjectAuto = !!(value?.type === 'new' && value.context?.author && value.context.author !== 'Undefined');
    if (key === 'subject' && isSubjectAuto) {
        setSubjectAuthor(value.context.author);
        newSubjectAuthor = value.context.author;
    } else if (key === 'subjectAuthor') {
        setSubjectAuthor(value);
        newSubjectAuthor = value;
    }

    const isObjectAuto = !!(value?.type === 'new' && value.context?.author && value.context.author !== 'Undefined');
    if (key === 'object' && isObjectAuto) {
        setObjectAuthor(value.context.author);
        newObjectAuthor = value.context.author;
    } else if (key === 'objectAuthor') {
        setObjectAuthor(value);
        newObjectAuthor = value;
    }

    if (key === 'relType') setRelType(value);

    const newState = {
      subject: key === 'subject' ? value : subject,
      object: key === 'object' ? value : object,
      relType: key === 'relType' ? value : relType,
      subjectAuthor: newSubjectAuthor,
      objectAuthor: newObjectAuthor,
    };

    chrome.storage.local.set({ linkerState: newState });
  };

  const captureSelection = (): StagedItem | null => {
    if (selectedUnit) return { type: 'existing', unit: selectedUnit };
    if (currentSelection) return { type: 'new', ...currentSelection };
    return null;
  };

  const handleDelete = async () => {
    if (!selectedUnit?.id) return;
    if (!confirm("Are you sure you want to delete this link? Both ends will be removed.")) return;

    setIsSubmitting(true);
    try {
      await del(`/api/contribute/unit/${selectedUnit.id}`);
      alert("Link deleted.");
      clearSelection();
      setListRefreshKey(prev => prev + 1);
      chrome.tabs.reload();
    } catch (e: any) {
      alert("Error deleting: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!subject || !object) return;
    setIsSubmitting(true);

    try {
      let subjectId = subject.type === 'existing' ? subject.unit.id : null;
      if (!subjectId && subject.type === 'new') {
        const res = await post('/api/contribute/unit', {
          source_code: subject.context.source_code,
          source_page_id: subject.context.source_page_id,
          title: subject.context.title,
          text_content: subject.text,
          start_char_index: subject.offsets.start,
          end_char_index: subject.offsets.end,
          connected_anchors: (subject as any).connected_anchors || [],
          author: subjectAuthor,
          unit_type: "link_subject"
        });
        subjectId = res.unit_id;
      }

      let objectId = object.type === 'existing' ? object.unit.id : null;
      if (!objectId && object.type === 'new') {
        const res = await post('/api/contribute/unit', {
          source_code: object.context.source_code,
          source_page_id: object.context.source_page_id,
          title: object.context.title,
          text_content: object.text,
          start_char_index: object.offsets.start,
          end_char_index: object.offsets.end,
          connected_anchors: (object as any).connected_anchors || [],
          author: objectAuthor,
          unit_type: "link_object"
        });
        objectId = res.unit_id;
      }

      if (!subjectId || !objectId) throw new Error("Failed to resolve Unit IDs");

      await post('/api/contribute/relationship', {
        subject_unit_id: subjectId,
        object_unit_id: objectId,
        relationship_type: relType
      });

      alert("Relationship Linked!");
      updateState('clear', null);
      setListRefreshKey(prev => prev + 1);
      chrome.tabs.reload();

    } catch (e: any) {
      alert("Error linking: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJumpToUnit = (unit: any) => {
    if (!unit) return;
    chrome.runtime.sendMessage({ 
        type: 'NAVIGATE_TO_UNIT', 
        unit_id: unit.id,
        source_code: unit.source_code,
        source_page_id: unit.source_page_id,
        title: unit.title,
        connected_anchors: unit.connected_anchors
    });
  };

  const AuthorSelect = ({ 
    value, 
    onChange, 
    disabled 
  }: { value: string, onChange: (val: string) => void, disabled?: boolean }) => (
    <div className="mt-2">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
        Author / Speaker
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full text-xs border-slate-300 rounded p-1.5 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
      >
        {AUTHOR_OPTIONS.map(opt => (
          <option key={opt} value={opt}>{opt === 'Other' ? 'All others' : opt}</option>
        ))}
      </select>
    </div>
  );

  const isSubjectAuto = !!(subject?.type === 'new' && subject.context?.author && subject.context.author !== 'Undefined');
  const isObjectAuto = !!(object?.type === 'new' && object.context?.author && object.context.author !== 'Undefined');

  const REL_LABELS: Record<string, string> = {
    commentary: 'Commentary on',
    translation: 'Translation of',
    refutation: 'Refutation of',
    allusion: 'Allusion to'
  };

  const groupedRelationships = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const groups = new Map<string, any[]>();

    for (const r of allRelationships) {
      if (q) {
        const hay = `${r.relationship_type || ''} ${r.subject_page_title || ''} ${r.object_page_title || ''} ${r.subject_text || ''} ${r.object_text || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const key = REL_LABELS[r.relationship_type] || (r.relationship_type ? r.relationship_type.charAt(0).toUpperCase() + r.relationship_type.slice(1) : 'Linked Passages');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allRelationships, filterText]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // --- VIEW MODE ---
  if (selectedUnit && (selectedUnit.unit_type === 'link_subject' || selectedUnit.unit_type === 'link_object' || Boolean((selectedUnit as any).has_relationship))) {
    const isDedicatedLinkNode = selectedUnit.unit_type === 'link_subject' || selectedUnit.unit_type === 'link_object';
    const canDeleteLink = !isReadOnly && isDedicatedLinkNode && Boolean((selectedUnit as any).can_delete);
    return (
      <div className="p-4 space-y-4">
         <h2 className="text-lg font-bold text-slate-800 pr-20 dark:text-slate-100">
           {canDeleteLink ? 'Manage Link' : 'Link Details'}
         </h2>
         <div className="p-4 bg-slate-100 rounded border border-slate-300 dark:bg-slate-900 dark:border-slate-700">
            <span className="text-xs font-bold text-slate-500 uppercase block mb-2 dark:text-slate-400">
              Selected {selectedUnit.unit_type === 'link_subject' ? 'Subject' : 'Object'}
            </span>
            <p className="text-sm italic text-slate-700 mb-4 dark:text-slate-300">"{selectedUnit.text_content}"</p>
            
            <div className="flex gap-2">
              <button 
                onClick={clearSelection}
                className="flex-1 py-2 bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {canDeleteLink ? 'Back' : 'Close'}
              </button>
              {canDeleteLink && (
                <button 
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="flex-1 py-2 bg-red-600 text-white font-bold rounded hover:bg-red-700 disabled:opacity-50"
                >
                  {isSubmitting ? "Deleting..." : "Delete Link"}
                </button>
              )}
            </div>
         </div>
      </div>
    );
  }

  // --- CREATE MODE ---
  if (!isReadOnly && (subject || object || currentSelection)) {
    return (
        <div className="p-4 space-y-6">
        <div className="flex items-center pr-20">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Knowledge Linker</h2>
        </div>
        
        {/* SUBJECT */}
        <div className={`p-3 rounded border ${subject ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' : 'bg-slate-50 border-slate-200 border-dashed dark:bg-slate-900 dark:border-slate-700'}`}>
            <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">SUBJECT (Origin)</span>
            {subject && <button onClick={() => updateState('subject', null)} className="text-xs text-red-500 hover:underline">Clear</button>}
            </div>
            
            {subject ? (
            <>
                <p className="text-sm line-clamp-3 italic mb-2 dark:text-slate-300">
                "{subject.type === 'existing' ? subject.unit.text_content : subject.text}"
                </p>
                {subject.type === 'new' ? (
                <AuthorSelect 
                    value={subjectAuthor} 
                    onChange={(val) => updateState('subjectAuthor', val)} 
                    disabled={isSubjectAuto}
                />
                ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    Author: <span className="font-semibold">{subject.unit.author}</span>
                </div>
                )}
            </>
            ) : (
            <button 
                onClick={() => updateState('subject', captureSelection())}
                disabled={!currentSelection && !selectedUnit}
                className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
                Set Current Selection
            </button>
            )}
        </div>

        {/* REL TYPE */}
        <div className="flex items-center gap-2">
            <div className="h-px bg-slate-200 flex-1 dark:bg-slate-700"></div>
            <select 
            value={relType} 
            onChange={(e) => updateState('relType', e.target.value)}
            className="text-sm border-slate-300 rounded p-1 bg-white font-medium text-slate-700 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
            >
            <option value="commentary">Commentary on</option>
            <option value="translation">Translation of</option>
            <option value="refutation">Refutation of</option>
            <option value="allusion">Allusion to</option>
            </select>
            <div className="h-px bg-slate-200 flex-1 dark:bg-slate-700"></div>
        </div>

        {/* OBJECT */}
        <div className={`p-3 rounded border ${object ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-slate-50 border-slate-200 border-dashed dark:bg-slate-900 dark:border-slate-700'}`}>
            <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">OBJECT (Target)</span>
            {object && <button onClick={() => updateState('object', null)} className="text-xs text-red-500 hover:underline">Clear</button>}
            </div>

            {object ? (
            <>
                <p className="text-sm line-clamp-3 italic mb-2 dark:text-slate-300">
                "{object.type === 'existing' ? object.unit.text_content : object.text}"
                </p>
                {object.type === 'new' ? (
                <AuthorSelect 
                    value={objectAuthor} 
                    onChange={(val) => updateState('objectAuthor', val)} 
                    disabled={isObjectAuto}
                />
                ) : (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                    Author: <span className="font-semibold">{object.unit.author}</span>
                </div>
                )}
            </>
            ) : (
            <button 
                onClick={() => updateState('object', captureSelection())}
                disabled={!currentSelection && !selectedUnit}
                className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
            >
                Set Current Selection
            </button>
            )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-2">
            <button 
            onClick={() => updateState('clear', null)}
            disabled={!subject && !object}
            className="px-4 py-3 bg-white text-slate-600 font-bold rounded shadow border border-slate-300 hover:bg-slate-50 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"
            >
            Cancel
            </button>

            <button 
            onClick={handleSubmit}
            disabled={!subject || !object || isSubmitting}
            className="flex-1 py-3 bg-slate-800 text-white font-bold rounded shadow-lg hover:bg-slate-700 disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-700 dark:disabled:bg-slate-800"
            >
            {isSubmitting ? "Linking..." : "Create Connection"}
            </button>
        </div>
        </div>
    );
  }

  const renderRelRow = (rel: any, idx: number, showTitles = false) => (
    <div
      key={`${rel.subject_unit_id}-${rel.object_unit_id}-${idx}`}
      className="ml-3 pl-2.5 py-1.5 border-l-2 border-slate-200 dark:border-slate-800 space-y-1 text-xs"
    >
      {/* SUBJECT (Top) */}
      <button
        type="button"
        onClick={() => handleJumpToUnit({
          id: rel.subject_unit_id,
          source_code: rel.subject_source_code,
          source_page_id: rel.subject_page_id,
          title: rel.subject_page_title,
          text_content: rel.subject_text,
          connected_anchors: rel.subject_anchors
        })}
        className="w-full text-left py-1 px-1.5 rounded hover:bg-blue-50/80 transition-colors dark:hover:bg-blue-900/20"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-blue-600 uppercase dark:text-blue-400">Subject</span>
          {showTitles && rel.subject_page_title && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{rel.subject_page_title}</span>
          )}
        </div>
        <p className="text-xs text-slate-600 font-serif italic line-clamp-2 dark:text-slate-300">"{rel.subject_text}"</p>
      </button>

      {/* CONNECTOR (Middle) */}
      <div className="flex items-center gap-1 pl-1.5 text-[10px] font-bold text-slate-400 uppercase dark:text-slate-500">
        <ArrowsUpDownIcon className="w-3 h-3" />
        <span>{rel.relationship_type}</span>
      </div>

      {/* OBJECT (Bottom) */}
      <button
        type="button"
        onClick={() => handleJumpToUnit({
          id: rel.object_unit_id,
          source_code: rel.object_source_code,
          source_page_id: rel.object_page_id,
          title: rel.object_page_title,
          text_content: rel.object_text,
          connected_anchors: rel.object_anchors
        })}
        className="w-full text-left py-1 px-1.5 rounded hover:bg-emerald-50/80 transition-colors dark:hover:bg-emerald-900/20"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-emerald-600 uppercase dark:text-emerald-400">Object</span>
          {showTitles && rel.object_page_title && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{rel.object_page_title}</span>
          )}
        </div>
        <p className="text-xs text-slate-600 font-serif italic line-clamp-2 dark:text-slate-300">"{rel.object_text}"</p>
      </button>
    </div>
  );

  // --- LIST MODE ---
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
        {/* Header */}
        <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-10 space-y-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex bg-slate-100 p-1 rounded-lg mr-20 dark:bg-slate-800">
                <div className="flex-1 flex items-center justify-center py-1.5 text-xs font-semibold rounded-md bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400">
                    <LinkIcon className="w-3 h-3 mr-1" />
                    All Linked Passages ({allRelationships.length})
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                        type="text"
                        placeholder="Filter linked texts, titles, or types..."
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
                ) : groupedRelationships.length > 0 ? (
                    groupedRelationships.map(([groupName, items]) => {
                        const isOpen = Boolean(filterText.trim()) || expandedGroups.has(groupName);
                        return (
                            <DirectoryFolder
                                key={groupName}
                                label={groupName}
                                count={items.length}
                                isOpen={isOpen}
                                onToggle={() => toggleGroup(groupName)}
                            >
                                <div className="space-y-1.5">
                                    {items.map((rel: any, idx: number) => renderRelRow(rel, idx, true))}
                                </div>
                            </DirectoryFolder>
                        );
                    })
                ) : allRelationships.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 dark:text-slate-500">
                        <LinkOutlineIcon className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-xs max-w-xs leading-relaxed">
                            Select text on the page to begin linking it to another concept or explanation.
                        </p>
                    </div>
                ) : (
                    <div className="p-8 text-center text-slate-400 text-xs italic">
                        No matching links found.
                    </div>
                )}
            </div>
        </div>

        {/* Bottom Page Summary */}
        {relationships.length > 0 && (
            <BottomPageSection
                label={`This page contains: ${relationships.length} link${relationships.length !== 1 ? 's' : ''}`}
            >
                <div className="space-y-2">
                    {relationships.map((rel, idx) => renderRelRow(rel, idx, false))}
                </div>
            </BottomPageSection>
        )}
    </div>
  );
};
