import { PageMetadata } from '@/utils/types';

// [NEW] Helper to extract author from DOM
function getPageAuthor(): string {
    // 1. Try specific Bahai.works/Bahaipedia ID
    const headerEl = document.getElementById('header_author_text');
    if (headerEl) {
        const fn = headerEl.querySelector('.fn');
        return (fn?.textContent || headerEl.textContent || "Undefined").trim();
    }
    
    // 2. Fallback: Meta tag
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) {
        return metaAuthor.getAttribute('content') || "Undefined";
    }

    return "Undefined";
}

export const getPageMetadata = (): PageMetadata => {
    // FIX: Read the entire document (Head + Body). 
    // MediaWiki variables are almost always in the <head>.
    const html = document.documentElement.innerHTML;
    const url = window.location.hostname;

    // 1. Determine Source Code
    let sourceCode = 'unknown';
    if (url.includes('bahai.works')) sourceCode = 'bw';
    else if (url.includes('bahaipedia.org')) sourceCode = 'bp';
    else if (url.includes('bahaidata.org')) sourceCode = 'bd';

    // 2. Extract MediaWiki ID (wgArticleId)
    // Support both RLCONF JSON ("wgArticleId": 123) and legacy vars (wgArticleId = 123)
    let pageId = 0;
    const idJsonMatch = html.match(/"wgArticleId":\s*(\d+)/);
    const idVarMatch = html.match(/wgArticleId\s*=\s*(\d+)/);

    if (idJsonMatch) pageId = parseInt(idJsonMatch[1]);
    else if (idVarMatch) pageId = parseInt(idVarMatch[1]);

    // 3. Extract Revision ID (wgCurRevisionId)
    let revId = 0;
    const revJsonMatch = html.match(/"wgCurRevisionId":\s*(\d+)/);
    const revVarMatch = html.match(/wgCurRevisionId\s*=\s*(\d+)/);

    if (revJsonMatch) revId = parseInt(revJsonMatch[1]);
    else if (revVarMatch) revId = parseInt(revVarMatch[1]);

    // DEBUG: Log if we are still getting 0
    if (pageId === 0) {
        console.error("RAG Librarian Scraper: Failed to find wgArticleId in page HTML.");
    }

    return {
        source_code: sourceCode,
        source_page_id: pageId,
        latest_rev_id: revId,
        url: window.location.href,
        title: document.title.split(' - ')[0],
        author: getPageAuthor() // [NEW] Added author field
    };
};
