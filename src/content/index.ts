import { getPageMetadata } from './scraper';
import { initSelectionListener } from './selection_handler';
import { initHighlighter } from './highlighter';
import { CURRENT_SITE } from '@/utils/site_config'; // Import config
import '../styles/highlights.css';

const init = () => {
    console.log(`RAG Librarian: Initializing for source '${CURRENT_SITE.code}'`);

    // 1. MediaWiki Specific Guards
    if (CURRENT_SITE.isMediaWiki) {
        if (!document.body.classList.contains('action-view')) {
            console.log("RAG Librarian: Wiki Action is not 'view'. Hibernating.");
            return;
        }

        if (document.body.classList.contains('ns-special') || 
            document.body.classList.contains('ns--1') ||
            window.location.search.includes('diff=')) {
            console.log("RAG Librarian: Special/Diff page detected. Hibernating.");
            return;
        }

        if (document.body.classList.contains('ve-active')) {
            console.log("RAG Librarian: VisualEditor active. Hibernating.");
            return;
        }
    }

    // 2. General Guards (if any for Bahai.org, add here)

    // -----------------------------------------------------------
    // Safe to Initialize
    // -----------------------------------------------------------
    console.log("RAG Librarian: Active (Read Mode)");

    // Initialize Write Path
    initSelectionListener();

    // Initialize Read Path
    setTimeout(() => {
        initHighlighter();
    }, 1000);
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_PAGE_CONTEXT') {
        const meta = getPageMetadata();
        sendResponse(meta);
    }
    
    if (request.type === 'HIGHLIGHT_UNIT') {
        console.log("Highlight requested for:", request.unit);
    }
    return false;
});
