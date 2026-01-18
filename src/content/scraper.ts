import { PageMetadata } from '@/utils/types';
import { CURRENT_SITE } from '@/utils/site_config';

// STRICT Backend Requirement: Only these specific strings are allowed.
function getCanonicalAuthor(urlSlug: string): string {
    if (urlSlug.includes('the-bab')) return "The Báb";
    if (urlSlug.includes('bahaullah')) return "Bahá’u’lláh";
    if (urlSlug.includes('abdul-baha')) return "‘Abdu’l-Bahá";
    if (urlSlug.includes('shoghi-effendi')) return "Shoghi Effendi";
    if (urlSlug.includes('the-universal-house-of-justice')) return "Universal House of Justice";
    return "Undefined";
}

// Simple hash to turn a URL path into a stable Integer ID
// Required because DB schema enforces source_page_id as INT
function getPathHash(path: string): number {
    let hash = 0;
    if (path.length === 0) return hash;
    for (let i = 0; i < path.length; i++) {
        const char = path.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash); // Ensure positive ID
}

function getPageAuthor(): string {
    // 1. Bahai.org Specific Extraction
    if (CURRENT_SITE.code === 'lib') {
        const path = window.location.pathname;
        return getCanonicalAuthor(path);
    }

    // 2. MediaWiki / Standard Fallback (Bahai.works)
    const headerEl = document.getElementById('header_author_text');
    if (headerEl) {
        const text = (headerEl.textContent || "").trim();
        if (text.includes('Báb')) return "The Báb";
        if (text.includes('Bahá’u’lláh')) return "Bahá’u’lláh";
        if (text.includes('Abdu’l-Bahá')) return "‘Abdu’l-Bahá";
        if (text.includes('Shoghi Effendi')) return "Shoghi Effendi";
        if (text.includes('Universal House of Justice')) return "Universal House of Justice";
        
        const fn = headerEl.querySelector('.fn');
        return (fn?.textContent || text).trim();
    }
    
    // 3. Metadata Fallback
    const metaAuthor = document.querySelector('meta[name="author"]');
    if (metaAuthor) {
        return metaAuthor.getAttribute('content') || "Undefined";
    }

    return "Undefined";
}

export const getPageMetadata = (): PageMetadata => {
    // 1. Source Code from Config
    const sourceCode = CURRENT_SITE.code;

    // 2. Extract ID
    let pageId = 0;
    let revId = 1;

    if (CURRENT_SITE.isMediaWiki) {
        const html = document.documentElement.innerHTML;
        
        const idJsonMatch = html.match(/"wgArticleId":\s*(\d+)/);
        const idVarMatch = html.match(/wgArticleId\s*=\s*(\d+)/);
        if (idJsonMatch) pageId = parseInt(idJsonMatch[1]);
        else if (idVarMatch) pageId = parseInt(idVarMatch[1]);

        const revJsonMatch = html.match(/"wgCurRevisionId":\s*(\d+)/);
        const revVarMatch = html.match(/wgCurRevisionId\s*=\s*(\d+)/);
        if (revJsonMatch) revId = parseInt(revJsonMatch[1]);
        else if (revVarMatch) revId = parseInt(revVarMatch[1]);
    } else {
        // [UPDATE] For Bahai.org ('lib'), we now ALWAYS use the Path Hash as the ID.
        // We do NOT use the anchor hash here, because that is now stored in connected_anchors.
        // This prevents the "Leading Zero" bug in the DB 'source_page_id' column.
        pageId = getPathHash(window.location.pathname);
    }

    const titleParts = document.title.split(/ - | \| /);

    return {
        source_code: sourceCode,
        source_page_id: pageId,
        latest_rev_id: revId,
        url: window.location.href,
        title: titleParts[0].trim(),
        author: getPageAuthor()
    };
};
