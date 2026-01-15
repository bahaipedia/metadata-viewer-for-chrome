import { getPageMetadata } from './scraper';
import { findRangeFromOffsets } from '@/utils/offset_calculator';
import { LogicalUnit } from '@/utils/types';

// --- Global State for Highlighter ---
let cachedUnits: LogicalUnit[] = [];
let currentMode: string = 'TAXONOMY_MODE';
let pendingScrollId: number | null = null;

// Constants for Healer
const ANCHOR_SIZE = 50; 
const SEARCH_RADIUS = 2000; // Search +/- 2000 chars around original spot

export const initHighlighter = async () => {
    // 1. Load active mode
    const storageResult = await chrome.storage.local.get('highlightMode');
    if (storageResult.highlightMode) {
        currentMode = storageResult.highlightMode;
    }
    
    // Define helper first
    const fetchAndRender = async () => {
        const meta = getPageMetadata(); 

        if (!meta.source_code || !meta.source_page_id) {
            console.warn("Highlighter: Missing metadata, skipping fetch.");
            return;
        }

        const response = await chrome.runtime.sendMessage({
            type: 'FETCH_PAGE_DATA',
            source_code: meta.source_code,
            source_page_id: meta.source_page_id
        });

        if (response && response.units) {
            cachedUnits = response.units;
            
            // [NEW] Run the Healer before rendering
            await verifyAndHealUnits();
            
            renderHighlights(); 
        }
    };

    // 2. REGISTER LISTENER FIRST
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        
        if (request.type === 'GET_PAGE_CONTEXT') {
            const meta = getPageMetadata();
            sendResponse(meta);
            return true; 
        }

        if (request.type === 'UPDATE_HIGHLIGHTS' && Array.isArray(request.units)) {
            const incomingIds = new Set(request.units.map((u: any) => u.id));
            // Remove old versions of incoming units, then add new ones
            cachedUnits = [
                ...cachedUnits.filter(u => !incomingIds.has(u.id)), 
                ...request.units
            ];
            // Note: We assume newly created units are correct, no healing needed immediately
            renderHighlights();
        }

        if (request.type === 'TRIGGER_DATA_RELOAD') {
            fetchAndRender();
        }

        if (request.type === 'SCROLL_TO_UNIT') {
            pendingScrollId = request.unit_id;
            if (cachedUnits.length > 0) {
                attemptScroll();
            }
            sendResponse({ success: true });
        }
    });

    // 3. Initial Fetch
    await fetchAndRender();

    // 4. Listen to Storage changes
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.highlightMode) {
            currentMode = changes.highlightMode.newValue;
            renderHighlights();
        }
    });
};

// Helper: Extract ONLY visible text (ignores <script>, <style>, etc)
// This ensures our "Search" coordinates match what the user actually sees.
const getCleanPageText = (): string => {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                const parentTag = node.parentElement?.tagName.toLowerCase();
                if (['script', 'style', 'noscript', 'meta'].includes(parentTag || '')) {
                    return NodeFilter.FILTER_REJECT;
                }
                // Filter out empty whitespace nodes if your offset_calculator ignores them
                // For now, we keep them but collapse spaces in comparison logic
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    let text = "";
    let node;
    while ((node = walker.nextNode())) {
        text += node.textContent;
    }
    return text;
};

const verifyAndHealUnits = async () => {
    const updatesToSync: any[] = [];
    
    // We only generate the expensive "clean text" IF we actually need to heal something.
    let lazyCleanText: string | null = null;
    const getLazyText = () => {
        if (!lazyCleanText) lazyCleanText = getCleanPageText();
        return lazyCleanText;
    };

    const normalize = (str: string) => str.replace(/\s+/g, ' ').trim();

    cachedUnits.forEach(unit => {
        if ((unit as any).broken_index) return;

        // 1. PRIMARY CHECK: Trust the existing offset calculator first.
        // If findRangeFromOffsets works and text matches, THE UNIT IS FINE.
        // Do not verify against raw text strings, verify against the DOM.
        let isHealthy = false;
        try {
            const range = findRangeFromOffsets(unit.start_char_index, unit.end_char_index);
            if (range) {
                const rangeText = range.toString();
                // Check Exact or Soft Match
                if (rangeText === unit.text_content || normalize(rangeText) === normalize(unit.text_content)) {
                    isHealthy = true;
                }
            }
        } catch (e) {
            isHealthy = false;
        }

        if (isHealthy) return; // SKIP HEALING

        // ---------------------------------------------------------
        // UNIT IS BROKEN -> Trigger Healer
        // ---------------------------------------------------------
        
        const cleanPageText = getLazyText();
        const healedOffsets = performAnchorSearch(unit, cleanPageText);

        if (healedOffsets) {
            console.log(`[Healer] Fixed Unit ${unit.id}: Moved from ${unit.start_char_index} to ${healedOffsets.start}`);
            
            // Update local memory so it renders NOW
            unit.start_char_index = healedOffsets.start;
            unit.end_char_index = healedOffsets.end;
            
            updatesToSync.push({
                id: unit.id,
                start_char_index: healedOffsets.start,
                end_char_index: healedOffsets.end
            });
        } else {
            console.warn(`[Healer] Failed to find Unit ${unit.id}. Marking broken.`);
            (unit as any).broken_index = 1;
            updatesToSync.push({
                id: unit.id,
                broken_index: 1
            });
        }
    });

    if (updatesToSync.length > 0) {
        chrome.runtime.sendMessage({
            type: 'BATCH_REALIGN_UNITS',
            updates: updatesToSync
        });
    }
};

const performAnchorSearch = (unit: LogicalUnit, pageText: string) => {
    const originalStart = unit.start_char_index;
    const textLen = unit.text_content.length;
    
    // Define Neighborhood (search +/- 2000 chars)
    const searchStart = Math.max(0, originalStart - SEARCH_RADIUS);
    const searchEnd = Math.min(pageText.length, originalStart + textLen + SEARCH_RADIUS);
    const neighborhood = pageText.substring(searchStart, searchEnd);

    const headAnchor = unit.text_content.substring(0, ANCHOR_SIZE);
    const tailAnchor = unit.text_content.substring(unit.text_content.length - ANCHOR_SIZE);

    // Search
    const foundHeadRel = neighborhood.indexOf(headAnchor);
    // Use lastIndexOf for tail to capture the widest possible match if repeated words exist
    let foundTailRel = neighborhood.lastIndexOf(tailAnchor); 

    if (foundHeadRel !== -1 && foundTailRel !== -1) {
        const newStart = searchStart + foundHeadRel;
        const newEnd = searchStart + foundTailRel + ANCHOR_SIZE;

        // Validation: New length should be "close enough" (allow 20% variance for edits)
        const newLen = newEnd - newStart;
        const lenDiff = Math.abs(newLen - textLen);

        if (lenDiff < Math.max(50, textLen * 0.2)) {
             return { start: newStart, end: newEnd };
        }
    }
    return null;
};

// --- RENDER LOGIC ---
const renderHighlights = () => {
    // 1. Clear Existing Highlights
    document.querySelectorAll('.rag-highlight').forEach(el => {
        const parent = el.parentNode;
        if (parent) {
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
        }
    });

    // 2. Filter Units based on Mode AND Integrity
    const unitsToRender = cachedUnits.filter(unit => {
        // [NEW] Never render broken units
        if ((unit as any).broken_index) return false;

        // Mode Logic
        if (currentMode === 'TAXONOMY_MODE') return unit.unit_type === 'user_highlight';
        if (currentMode === 'CREATE_MODE') return !['canonical_answer', 'link_subject', 'link_object', 'user_highlight'].includes(unit.unit_type); 
        if (currentMode === 'QA_MODE') return unit.unit_type === 'canonical_answer';
        if (currentMode === 'RELATIONS_MODE') return unit.unit_type === 'link_subject' || unit.unit_type === 'link_object';

        return false; 
    });

    // 3. Draw
    unitsToRender.forEach(highlightUnit);

    // 4. NEW: Check for pending scroll (Fixes race condition on new page load)
    if (pendingScrollId) {
        attemptScroll();
    }
};

// Helper to perform the scroll with Retry Logic
const attemptScroll = (attempts = 10) => {
    if (!pendingScrollId) return;

    const el = document.querySelector(`.rag-highlight[data-unit-id="${pendingScrollId}"]`);
    
    if (el) {
        // FOUND IT: Scroll and Flash
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const originalTransition = (el as HTMLElement).style.transition;
        const originalBg = (el as HTMLElement).style.backgroundColor;
        
        (el as HTMLElement).style.transition = "background-color 0.5s ease";
        (el as HTMLElement).style.backgroundColor = "rgba(255, 235, 59, 0.8)"; // Bright Yellow

        setTimeout(() => {
            (el as HTMLElement).style.backgroundColor = originalBg;
            setTimeout(() => {
                (el as HTMLElement).style.transition = originalTransition;
            }, 500);
        }, 1500);

        pendingScrollId = null; // Clear queue
    } else if (attempts > 0) {
        // NOT FOUND YET: Retry in 250ms
        // IMPORTANT: No console.error here. We expect this to fail a few times.
        setTimeout(() => attemptScroll(attempts - 1), 250);
    } else {
        // ONLY log if we have run out of attempts (e.g. after ~2.5 seconds)
        console.warn(`Unit ${pendingScrollId} not found in DOM after retries.`);
        pendingScrollId = null;
    }
};

const highlightUnit = (unit: LogicalUnit) => {
    try {
        const range = findRangeFromOffsets(unit.start_char_index, unit.end_char_index);
        
        if (!range) {
            // console.warn(`Could not map unit ${unit.id} to DOM.`);
            return;
        }
        safeHighlightRange(range, unit);
    } catch (e) {
        console.error("Highlight error for unit", unit.id, e);
    }
};

const safeHighlightRange = (range: Range, unit: LogicalUnit) => {
    const commonAncestor = range.commonAncestorContainer;
    const nodesToWrap: { node: Node, start: number, end: number }[] = [];

    if (commonAncestor.nodeType === Node.TEXT_NODE) {
        nodesToWrap.push({
            node: commonAncestor,
            start: range.startOffset,
            end: range.endOffset
        });
    } else {
        const walker = document.createTreeWalker(
            commonAncestor,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: (node) => {
                    if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;
                    return NodeFilter.FILTER_REJECT;
                }
            }
        );

        let currentNode = walker.nextNode();
        while (currentNode) {
            const isStartNode = (currentNode === range.startContainer);
            const isEndNode = (currentNode === range.endContainer);
            
            const startOffset = isStartNode ? range.startOffset : 0;
            const endOffset = isEndNode ? range.endOffset : (currentNode.textContent?.length || 0);

            if (currentNode.textContent && currentNode.textContent.trim().length > 0) {
                 nodesToWrap.push({ node: currentNode, start: startOffset, end: endOffset });
            }
            
            currentNode = walker.nextNode();
        }
    }

    nodesToWrap.forEach(({ node, start, end }) => {
        const wrapper = document.createElement('span');
        wrapper.className = `rag-highlight unit-type-${unit.unit_type || 'default'}`;
        wrapper.dataset.unitId = String(unit.id);
        
        wrapper.addEventListener('mouseenter', () => {
            const allParts = document.querySelectorAll(`.rag-highlight[data-unit-id="${unit.id}"]`);
            allParts.forEach(el => el.classList.add('active'));
        });

        wrapper.addEventListener('mouseleave', () => {
            const allParts = document.querySelectorAll(`.rag-highlight[data-unit-id="${unit.id}"]`);
            allParts.forEach(el => el.classList.remove('active'));
        });

        wrapper.addEventListener('click', (e) => {
            e.stopPropagation(); 
            chrome.runtime.sendMessage({ type: 'UNIT_CLICKED', unit });
        });

        const rangePart = document.createRange();
        rangePart.setStart(node, start);
        rangePart.setEnd(node, end);
        rangePart.surroundContents(wrapper);
    });
};
