import { getPageMetadata } from './scraper';
import { findRangeFromOffsets } from '@/utils/offset_calculator';
import { LogicalUnit } from '@/utils/types';

export const initHighlighter = async () => {
    const meta = getPageMetadata();
    
    // 1. Ask Background script to fetch data (Avoid CORS in Content Script)
    const response = await chrome.runtime.sendMessage({
        type: 'FETCH_PAGE_DATA',
        source_code: meta.source_code,
        source_page_id: meta.source_page_id
    });

    if (response && response.units) {
        response.units.forEach((unit: LogicalUnit) => {
            highlightUnit(unit);
        });
    }
};

const highlightUnit = (unit: LogicalUnit) => {
    try {
        // 2. Convert DB Ints -> DOM Range
        const range = findRangeFromOffsets(unit.start_char_index, unit.end_char_index);
        
        if (!range) {
            console.warn(`Could not map unit ${unit.id} to DOM. Content may have changed.`);
            return;
        }

        // 3. Create the Highlight Element
        // We use the CSS Custom Highlight API if available (modern), or span wrapping (fallback)
        // For simplicity, we'll use span wrapping here, but note that it modifies the DOM structure.
        
        const wrapper = document.createElement('span');
        wrapper.className = `rag-highlight unit-type-${unit.unit_type}`;
        wrapper.dataset.unitId = String(unit.id);
        
        // This splits the text nodes safely
        range.surroundContents(wrapper);
        
        // 4. Add Click Listener (Open Side Panel in "View Mode")
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger selection handler
            chrome.runtime.sendMessage({ type: 'UNIT_CLICKED', unit });
        });

    } catch (e) {
        console.error("Highlight error for unit", unit.id, e);
    }
};
