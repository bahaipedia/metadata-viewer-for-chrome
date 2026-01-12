import { getPageMetadata } from './scraper';
import { calculateOffsets } from '@/utils/offset_calculator';

let debounceTimer: NodeJS.Timeout;

export const initSelectionListener = () => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection); // Handle keyboard selection (Shift+Arrow)
};

const handleSelection = () => {
    // Debounce to prevent firing while dragging
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        const range = selection?.getRangeAt(0);
        const selectedText = selection?.toString().trim(); // DELETE??
        const offsets = calculateOffsets(range!);

        // 1. If nothing selected, tell Side Panel to clear the form
        if (!selectedText || selectedText.length < 5) {
            chrome.runtime.sendMessage({ type: 'SELECTION_CLEARED' });
            return;
        }

        // 2. Validate selection is inside the Wiki Content (ignore sidebar/footer selections)
        const anchorNode = selection?.anchorNode;
        const contentContainer = document.querySelector('#mw-content-text');
        
        if (!contentContainer || !contentContainer.contains(anchorNode)) {
             return; // Selection is outside the article body
        }

        // 3. Send to Side Panel
        // We send the metadata immediately so the form knows which Page ID to attach to
        const context = getPageMetadata();
        
        chrome.runtime.sendMessage({
            type: 'TEXT_SELECTED',
            text: selectedText,
            context: context,
            offsets: offsets
        });

    }, 500); // 500ms delay
};
