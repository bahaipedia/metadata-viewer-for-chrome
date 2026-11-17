import React, { useState, useEffect, useMemo } from 'react';
import { QuestionMarkCircleIcon, MagnifyingGlassIcon, ChatBubbleLeftRightIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useAuth } from '@/side_panel/context/AuthContext';
import { PinnedPageSection, DirectoryFolder } from '@/side_panel/components/StackedDirectory';
import { useApi } from '@/hooks/useApi';
import { LogicalUnit, PageMetadata } from '@/utils/types';

type StagedAnswer = 
  | { type: 'existing', unit: LogicalUnit }
  | { type: 'new', text: string, offsets: { start: number, end: number }, context: PageMetadata, connected_anchors?: number[] };

export const QAManager = () => {
  const { currentSelection, selectedUnit, clearSelection, refreshTrigger } = useSelection();
  const { isReadOnly, workspaceKey } = useAuth();
  const { post, del, get } = useApi();

  const [questionText, setQuestionText] = useState('');
  const [author, setAuthor] = useState("‘Abdu’l-Bahá");
  const [answer, setAnswer] = useState<StagedAnswer | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [isAutoDetected, setIsAutoDetected] = useState(false);

  const [pageQAs, setPageQAs] = useState<any[]>([]);
  const [allQAs, setAllQAs] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [directoryOpen, setDirectoryOpen] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [listRefreshKey, setListRefreshKey] = useState(0);

  useEffect(() => {
    if (isReadOnly) {
      setIsCreating(false);
      if (answer?.type === 'new') {
        setAnswer(null);
      }
    }
  }, [isReadOnly]);

  useEffect(() => {
    let isMounted = true;
    setPageQAs([]);

    const fetchPageQAs = async (retryCount = 0) => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) return;

        const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_CACHED_STATS' }).catch(() => null);
        const pageSourceCode = res?.source_code || res?.units?.[0]?.source_code;
        const pageSourcePageId = res?.source_page_id || res?.units?.[0]?.source_page_id;
        const answerIds = Array.isArray(res?.units)
          ? res.units.filter((u: any) => u.unit_type === 'canonical_answer').map((u: any) => u.id).filter(Boolean).join(',')
          : '';

        if ((pageSourceCode && pageSourcePageId) || answerIds) {
          const params = new URLSearchParams();
          if (pageSourceCode && pageSourcePageId) {
            params.set('source_code', String(pageSourceCode));
            params.set('source_page_id', String(pageSourcePageId));
          }
          if (answerIds) {
            params.set('answer_unit_ids', answerIds);
          }
          const rows = await get(`/api/qa?${params.toString()}`);
          if (isMounted) setPageQAs(Array.isArray(rows) ? rows : []);
          return;
        }

        if (retryCount < 8 && isMounted) {
          setTimeout(() => fetchPageQAs(retryCount + 1), 250);
        } else if (isMounted) {
          setPageQAs([]);
        }
      } catch (e) {
        if (isMounted) setPageQAs([]);
      }
    };

    fetchPageQAs();
    return () => { isMounted = false; };
  }, [refreshTrigger, workspaceKey]);

  useEffect(() => {
    let isMounted = true;
    setLoadingAll(true);
    get('/api/qa?scope=all')
      .then((rows) => {
        if (isMounted) setAllQAs(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        console.error("Failed to fetch all Q&A pairs", err);
        if (isMounted) setAllQAs([]);
      })
      .finally(() => {
        if (isMounted) setLoadingAll(false);
      });
    return () => { isMounted = false; };
  }, [workspaceKey, listRefreshKey]);

  useEffect(() => {
    if (currentSelection?.context?.author && currentSelection.context.author !== 'Undefined') {
        setAuthor(currentSelection.context.author);
        setIsAutoDetected(true);
    } else if (!selectedUnit) {
        // Only reset if we aren't editing an existing unit
        setIsAutoDetected(false);
    }
  }, [currentSelection, selectedUnit]);

  // --- 1. Edit Mode: Load existing QA ---
  useEffect(() => {
    const loadEditMode = async () => {
      if (selectedUnit && selectedUnit.unit_type === 'canonical_answer') {
        setAnswer({ type: 'existing', unit: selectedUnit });
        setAuthor(selectedUnit.author || "‘Abdu’l-Bahá");
        setDeleteConfirmOpen(false); // Reset UI state

        try {
          const res = await get(`/api/qa?answer_unit_id=${selectedUnit.id}`);
          if (res && res.length > 0) {
             setQuestionText(res[0].question_text);
          }
        } catch (e) {
          console.error("Failed to fetch linked question", e);
        }
      }
    };
    loadEditMode();
  }, [selectedUnit]);

  // --- 2. Helpers ---
  // Extracts "Some Answered Questions" from "https://bahai.works/Some_Answered_Questions/17"
  const deriveBookTitle = async (): Promise<string> => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    if (!tab || !tab.url) return "Unknown Source";

    try {
        const urlObj = new URL(tab.url);
        
        // Strategy A: URL Parsing (Preferred)
        // MediaWiki structure: /Main_Book_Title/Sub_Page_Title...
        const pathSegments = urlObj.pathname.split('/').filter(p => p);
        
        if (pathSegments.length > 0) {
            // "Book_Title" or "Some_Answered_Questions"
            let bookSegment = pathSegments[0];
            
            // 1. Replace Underscores with Spaces
            // 2. Decode URI (handles %20, %2C, etc.)
            return decodeURIComponent(bookSegment.replace(/_/g, ' '));
        }

        // Strategy B: Title Parsing (Fallback)
        // Only runs if URL parsing failed (e.g. strict root path, weird permalinks)
        // Title format: "Some Answered Questions/17 - Bahaiworks"
        if (tab.title) {
            // 1. Split by " - " to remove the site name suffix
            const pageName = tab.title.split(' - ')[0].trim(); 
            
            // 2. Split by "/" to remove subpages
            // This is safe because MediaWiki puts spaces around slashes in Titles rarely, 
            // but usually / denotes subpage.
            return pageName.split('/')[0].trim(); 
        }

    } catch (e) {
        console.warn("Error parsing book title:", e);
    }
    return "Unknown Book";
  };

  const handleSetAnswer = () => {
    if (selectedUnit) {
      setAnswer({ type: 'existing', unit: selectedUnit });
      clearSelection();
    } else if (currentSelection) {
      setAnswer({ type: 'new', ...currentSelection });
      clearSelection();
    }
  };

  const handleSetQuestionFromText = () => {
    if (currentSelection) setQuestionText(currentSelection.text);
    else if (selectedUnit) setQuestionText(selectedUnit.text_content);
  };

  const handleCancel = () => {
    if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false);
    } else {
        setQuestionText('');
        setAnswer(null);
        setIsCreating(false);
        clearSelection();
    }
  };

  const handleDelete = async () => {
    // Step 1: Open Confirmation
    if (!deleteConfirmOpen) {
        setDeleteConfirmOpen(true);
        return;
    }

    // Step 2: Actually Delete
    if (answer?.type !== 'existing') return;
    
    setIsSubmitting(true);
    try {
        await del(`/api/units/${answer.unit.id}`);
        setQuestionText('');
        setAnswer(null);
        clearSelection();
        setDeleteConfirmOpen(false);
        setListRefreshKey(prev => prev + 1);
        chrome.tabs.reload();
    } catch (e: any) {
        alert("Delete failed: " + e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!questionText || !answer) return;
    setIsSubmitting(true);

    try {
      const bookTitle = await deriveBookTitle();

      // 1. Fetch Clean Metadata from Scraper (Single Source of Truth)
      // We reuse the message Label.tsx uses to get data processed by scraper.ts
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      let cleanTitle = "Unknown Title";

      if (tabs[0]?.id) {
         try {
           const scraperData = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_CACHED_STATS' });
           // The scraper has already handled the " - SiteName" splitting logic
           if (scraperData?.title) {
             cleanTitle = scraperData.title;
           }
         } catch (err) {
           console.warn("Could not retrieve metadata from content script", err);
         }
      }

      if (answer.type === 'existing') {
        await del(`/api/units/${answer.unit.id}`);
      }

      const unitPayload = answer.type === 'existing' ? {
          source_code: answer.unit.source_code,
          source_page_id: answer.unit.source_page_id,
          title: cleanTitle,
          text_content: answer.unit.text_content,
          start_char_index: answer.unit.start_char_index,
          end_char_index: answer.unit.end_char_index,
          connected_anchors: answer.unit.connected_anchors
      } : {
          source_code: answer.context.source_code,
          source_page_id: answer.context.source_page_id,
          title: answer.context.title,
          text_content: answer.text,
          start_char_index: answer.offsets.start,
          end_char_index: answer.offsets.end,
          connected_anchors: answer.connected_anchors || []
      };

      const unitRes = await post('/api/contribute/unit', {
        ...unitPayload, 
        author: author,
        unit_type: "canonical_answer"
      });

      await post('/api/contribute/qa', {
        question_text: questionText,
        answer_unit_id: unitRes.unit_id,
        source_book: bookTitle 
      });

      alert(answer.type === 'existing' ? "Q&A Updated!" : "Q&A Created!");
      handleCancel();
      setListRefreshKey(prev => prev + 1);
      chrome.tabs.reload(); 

    } catch (e: any) {
      console.error(e);
      alert("Error saving: " + (e.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isEditMode = answer?.type === 'existing';
  const canDelete = !isReadOnly && isEditMode && Boolean((answer.unit as any).can_delete);
  const isViewReadOnly = isEditMode && (isReadOnly || !canDelete);
  const showBuilder = isEditMode || (!isReadOnly && (isCreating || Boolean(answer) || Boolean(currentSelection)));

  const groupedQAs = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const groups = new Map<string, any[]>();

    for (const item of allQAs) {
      const fullTitle = item.title || '';
      const [rootTitle, ...rest] = fullTitle.split('/');
      const groupName = (item.source_book && item.source_book !== 'Unknown' && item.source_book !== 'Unknown Source')
        ? item.source_book
        : (rootTitle.trim() || 'General');
      const subTitle = rest.join(' / ').trim() || fullTitle;

      if (q) {
        const hay = `${groupName} ${fullTitle} ${item.question_text || ''} ${item.answer_text || ''} ${item.author || ''}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }

      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName)!.push({ ...item, _subTitle: subTitle });
    }

    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allQAs, filterText]);

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleJumpToQA = (qa: any) => {
    chrome.runtime.sendMessage({
      type: 'NAVIGATE_TO_UNIT',
      unit_id: qa.answer_unit_id,
      source_code: qa.source_code,
      source_page_id: qa.source_page_id,
      title: qa.title,
      connected_anchors: qa.connected_anchors
    });
  };

  if (!showBuilder) {
    return (
      <div className="p-4 space-y-3 h-full flex flex-col overflow-hidden">
        <div className="flex justify-between items-center pr-10 flex-shrink-0">
          <div className="flex items-center gap-2 group relative">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Q&A Manager
            </h2>
            <QuestionMarkCircleIcon className="w-5 h-5 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />

            {/* Tooltip */}
            <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs font-normal rounded-md shadow-xl z-20 leading-relaxed dark:bg-slate-700">
              <p className="font-bold mb-1 border-b border-slate-600 pb-1">How to use this page:</p>
              <p>If you come across an authoritative answer to a specific question use this form to highlight it. Doing so would allow bahai.chat to provide the direct answer instead of trying to generate one.</p>
              <div className="absolute bottom-full left-6 border-8 border-transparent border-b-slate-800 dark:border-b-slate-700"></div>
            </div>
          </div>

          {!isReadOnly && (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
          )}
        </div>

        {pageQAs.length > 0 && (
          <PinnedPageSection
            label={`This page contains: ${pageQAs.length} Q&A Pair${pageQAs.length !== 1 ? 's' : ''}`}
            accent="emerald"
          >
            {pageQAs.map((qa) => (
              <button
                key={qa.id}
                onClick={() => handleJumpToQA(qa)}
                className="w-full text-left bg-white p-2 rounded border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col gap-1 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-emerald-700"
              >
                <span className="text-xs font-semibold text-slate-800 line-clamp-2 dark:text-slate-200">
                  Q: {qa.question_text}
                </span>
                <span className="text-xs text-slate-600 font-serif italic line-clamp-2 dark:text-slate-400">
                  "{qa.answer_text}"
                </span>
                {qa.author && (
                  <span className="text-[10px] text-right text-slate-400 dark:text-slate-500">
                    Answer: {qa.author}
                  </span>
                )}
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
            <span>All Q&A Pairs ({allQAs.length})</span>
            {directoryOpen ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
          </button>

          {directoryOpen && (
            <>
              <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter questions, answers, or books..."
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 text-xs border border-slate-200 rounded bg-slate-50 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
                {loadingAll ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading Q&A pairs...</div>
                ) : groupedQAs.length > 0 ? (
                  groupedQAs.map(([groupName, items]) => {
                    const isOpen = Boolean(filterText.trim()) || expandedGroups.has(groupName);
                    return (
                      <DirectoryFolder
                        key={groupName}
                        label={groupName}
                        count={items.length}
                        isOpen={isOpen}
                        onToggle={() => toggleGroup(groupName)}
                      >
                        {items.map((qa: any) => (
                          <button
                            key={qa.id}
                            onClick={() => handleJumpToQA(qa)}
                            className="w-full text-left bg-slate-50 hover:bg-blue-50/70 p-2 rounded border border-slate-200/80 hover:border-blue-200 transition-colors flex flex-col gap-1 dark:bg-slate-950 dark:border-slate-800 dark:hover:border-blue-800"
                          >
                            <span className="text-xs font-semibold text-slate-700 line-clamp-2 dark:text-slate-200">
                              Q: {qa.question_text}
                            </span>
                            <span className="text-xs text-slate-600 font-serif italic line-clamp-2 dark:text-slate-400">
                              "{qa.answer_text}"
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                              {qa.author || 'Unknown'}{qa._subTitle && qa._subTitle !== groupName ? ` • ${qa._subTitle}` : ''}
                            </span>
                          </button>
                        ))}
                      </DirectoryFolder>
                    );
                  })
                ) : allQAs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-slate-500">
                    <ChatBubbleLeftRightIcon className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-xs leading-relaxed">
                      Highlight an authoritative answer on a page (such as in Some Answered Questions) to pair it with its question.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 text-center text-xs italic text-slate-400">
                    No matching Q&A pairs found.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex justify-between items-center pr-10">
        <div className="flex items-center gap-2 group relative">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {isViewReadOnly ? "Q&A Details" : (isEditMode ? "Edit Q&A Pair" : "Q&A Builder")}
          </h2>
          <QuestionMarkCircleIcon className="w-5 h-5 text-slate-400 cursor-help hover:text-slate-600 transition-colors" />
          
          {/* Tooltip */}
          <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-72 p-3 bg-slate-800 text-white text-xs font-normal rounded-md shadow-xl z-20 leading-relaxed dark:bg-slate-700">
            <p className="font-bold mb-1 border-b border-slate-600 pb-1">How to use this page:</p>
            <p>If you come across an authoritative answer to a specific question use this form to highlight it. Doing so would allow bahai.chat to provide the direct answer instead of trying to generate one.</p>
            {/* Tooltip Arrow */}
            <div className="absolute bottom-full left-6 border-8 border-transparent border-b-slate-800 dark:border-b-slate-700"></div>
          </div>
        </div>
      </div>

      {/* QUESTION INPUT */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500 dark:text-slate-400">QUESTION</label>
        <div className="relative">
            <textarea 
            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[80px] disabled:bg-slate-100 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 dark:disabled:bg-slate-900"
            placeholder="Type the question here..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            disabled={isViewReadOnly}
            />
            {!isEditMode && !questionText && (
                <button 
                    type="button" 
                    onClick={handleSetQuestionFromText}
                    disabled={!currentSelection && !selectedUnit}
                    className="absolute top-2 right-2 text-[10px] bg-slate-100 border border-slate-300 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-0 transition-opacity dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                    Paste Selection
                </button>
            )}
        </div>
      </div>

      {/* AUTHOR DROPDOWN */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1 dark:text-slate-400">ANSWER AUTHOR</label>
        <select 
          className="w-full p-2 text-sm border rounded bg-white disabled:bg-slate-100 disabled:text-slate-500 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-200 dark:disabled:bg-slate-900 dark:disabled:text-slate-600"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          disabled={isAutoDetected || isViewReadOnly}
        >
          <option>Bahá’u’lláh</option>
          <option>The Báb</option>
          <option>‘Abdu’l-Bahá</option>
          <option>Shoghi Effendi</option>
          <option>Universal House of Justice</option>
        </select>
      </div>

      <div className="h-px bg-slate-200 my-2 dark:bg-slate-800"></div>

      {/* ANSWER DISPLAY */}
      <div className={`p-3 rounded border ${answer ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-slate-50 border-slate-200 border-dashed dark:bg-slate-900 dark:border-slate-700'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">ANSWER (Highlight Text)</span>
          {answer && !isEditMode && (
             <button onClick={() => setAnswer(null)} className="text-xs text-red-500 hover:underline">Clear</button>
          )}
        </div>

        {answer ? (
          <p className="text-sm line-clamp-4 italic dark:text-slate-300">"{answer.type === 'existing' ? answer.unit.text_content : answer.text}"</p>
        ) : (
          <button 
            onClick={handleSetAnswer}
            disabled={!currentSelection && !selectedUnit}
            className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {currentSelection || selectedUnit ? "Set Active Selection as Answer" : "Highlight text to select..."}
          </button>
        )}
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex gap-2 pt-2 border-t border-slate-100 mt-4 dark:border-slate-800">
        
        {/* A. Cancel / Close */}
        <button 
            type="button" 
            onClick={handleCancel} 
            className={`py-2 text-sm text-slate-600 hover:bg-slate-100 rounded border border-transparent hover:border-slate-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:border-slate-700 ${
                (isEditMode && !isViewReadOnly) ? "px-3" : "flex-1"
            }`}
        >
            {deleteConfirmOpen ? 'Cancel' : (isEditMode ? 'Close' : 'Cancel')} 
        </button>

        {/* B. Create / Update (Hidden if confirming delete or read-only) */}
        {!deleteConfirmOpen && !isViewReadOnly && (
            <button 
                onClick={handleSubmit}
                disabled={!questionText || !answer || isSubmitting}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800"
            >
                {isSubmitting ? "Processing..." : (isEditMode ? "Update" : "Save Q&A Pair")}
            </button>
        )}

        {/* C. Delete (Edit Mode Only) */}
        {canDelete && (
            <button 
                type="button"
                onClick={handleDelete}
                className={`px-3 py-2 text-sm rounded transition-all duration-200 border ${
                    deleteConfirmOpen 
                        ? 'flex-1 bg-red-600 text-white border-red-700 hover:bg-red-700 font-bold' 
                        : 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 dark:bg-transparent dark:text-red-400 dark:border-red-900 dark:hover:bg-red-900/20' 
                }`}
            >
                {deleteConfirmOpen ? "Confirm Delete?" : "Delete"}
            </button>
        )}
      </div>
    </div>
  );
};
