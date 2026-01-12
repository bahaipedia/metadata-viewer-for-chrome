import { getPageMetadata } from './scraper';
import { calculateOffsets } from '@/utils/offset_calculator';

let debounceTimer: NodeJS.Timeout;

export const initSelectionListener = () => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection); // Handle keyboard selection (Shift+Arrow)
};

const handleSelection = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        // 1. Validation: If nothing selected, clear form & exit early
        // This prevents 'getRangeAt' errors on empty clicks
        if (!selection || !selectedText || selectedText.length < 5) {
            chrome.runtime.sendMessage({ type: 'SELECTION_CLEARED' });
            return;
        }

        // 2. Validate Container (Context check)
        const anchorNode = selection.anchorNode;
        const contentContainer = document.querySelector('#mw-content-text');
        
        if (!contentContainer || !contentContainer.contains(anchorNode)) {
             return; 
        }

        // 3. Heavy Math: Only calculate offsets if we know we are keeping the data
        const range = selection.getRangeAt(0);
        const offsets = calculateOffsets(range);

        // 4. Send
        const context = getPageMetadata();
        
        chrome.runtime.sendMessage({
            type: 'TEXT_SELECTED',
            text: selectedText,
            context: context,
            offsets: offsets
        });

    }, 500);
};
