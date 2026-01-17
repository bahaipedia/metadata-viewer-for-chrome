import { getPageMetadata } from './scraper';
import { calculateOffsets } from '@/utils/offset_calculator';
import { CURRENT_SITE } from '@/utils/site_config';

let debounceTimer: NodeJS.Timeout;

export const initSelectionListener = () => {
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);
};

const handleSelection = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        if (!selection || !selectedText || selectedText.length < 5) {
            chrome.runtime.sendMessage({ type: 'SELECTION_CLEARED' });
            return;
        }

        const context = getPageMetadata();
        const range = selection.getRangeAt(0);
        let payload: any = {
            type: 'TEXT_SELECTED',
            text: selectedText,
            context: context,
            offsets: { start: 0, end: 0 },
            connected_anchors: [] 
        };

        // ---------------------------------------------------------
        // STRATEGY: BAHAI.ORG (Anchor-Relative + Multi-Block)
        // ---------------------------------------------------------
        if (CURRENT_SITE.code === 'lib') {

            // 1. Find START Anchor (String ID)
            const startAnchorData = findUpstreamAnchor(range.startContainer);
            if (!startAnchorData) {
                console.warn("Selection Handler: Could not find starting anchor.");
                return;
            }

            // 2. Find END Anchor (String ID)
            const endAnchorData = findUpstreamAnchor(range.endContainer);
            
            // 3. Find INTERMEDIATE Anchors
            const anchorsFound: string[] = [];
            
            // [UPDATE] ALWAYS add the start anchor to the list
            anchorsFound.push(startAnchorData.id);

            if (endAnchorData && startAnchorData.id !== endAnchorData.id) {
                const commonAncestor = range.commonAncestorContainer;
                const walker = document.createTreeWalker(
                    commonAncestor.nodeType === Node.ELEMENT_NODE ? commonAncestor : commonAncestor.parentNode!,
                    NodeFilter.SHOW_ELEMENT,
                    { acceptNode: (node) => {
                        if (isValidAnchor(node) && range.intersectsNode(node)) {
                            // Avoid duplicates if traversed
                            if ((node as Element).id !== startAnchorData.id) {
                                return NodeFilter.FILTER_ACCEPT;
                            }
                        }
                        return NodeFilter.FILTER_SKIP;
                    }}
                );

                while (walker.nextNode()) {
                    // [UPDATE] Keep ID as string
                    const id = (walker.currentNode as Element).id;
                    if (id) anchorsFound.push(id);
                }
                
                // Ensure End Anchor is included
                if (!anchorsFound.includes(endAnchorData.id)) {
                    anchorsFound.push(endAnchorData.id);
                }
            }

            // 4. Calculate Offsets
            const startOffset = calculateRelativeOffset(startAnchorData.node, range.startContainer, range.startOffset);
            const targetEndAnchor = endAnchorData ? endAnchorData.node : startAnchorData.node;
            const endOffset = calculateRelativeOffset(targetEndAnchor, range.endContainer, range.endOffset);

            // 5. Construct Payload
            // [UPDATE] Do NOT overwrite context.source_page_id. It is now the Path Hash (Bucket).
            // context.source_page_id = ... (REMOVED)
            
            payload.offsets = { start: startOffset, end: endOffset };
            
            // [UPDATE] Store ALL anchors here
            payload.connected_anchors = Array.from(new Set(anchorsFound)); 
            
            console.log(`Selection: ${startAnchorData.id} -> ${endAnchorData?.id}`, payload);

        } else {
            // STRATEGY: MEDIAWIKI
            const contentContainer = document.querySelector(CURRENT_SITE.contentSelector);
            if (contentContainer && contentContainer.contains(selection.anchorNode)) {
                payload.offsets = calculateOffsets(range, CURRENT_SITE.contentSelector);
            } else {
                return;
            }
        }

        chrome.runtime.sendMessage(payload);

    }, 500);
};

// --- HELPERS ---

const isValidAnchor = (node: Node): boolean => {
    return (node instanceof Element) && 
           node.classList.contains('brl-location') && 
           !!node.id;
};

// [UPDATE] Returns ID as string
const findUpstreamAnchor = (node: Node | null): { id: string, node: Node } | null => {
    let curr = node;
    while (curr) {
        if (isValidAnchor(curr)) {
            return { id: (curr as Element).id, node: curr };
        }

        let sib = curr.previousSibling;
        while (sib) {
            if (isValidAnchor(sib)) {
                return { id: (sib as Element).id, node: sib };
            }
            if (sib.nodeType === Node.ELEMENT_NODE && (sib as Element).querySelector) {
                const childAnchor = (sib as Element).querySelector('.brl-location[id]');
                if (childAnchor) {
                     return { id: childAnchor.id, node: childAnchor };
                }
            }
            sib = sib.previousSibling;
        }

        curr = curr.parentNode;
        if (curr && (curr as Element).classList?.contains('library-document-content')) {
            break;
        }
    }
    return null;
};

const calculateRelativeOffset = (anchorNode: Node, targetNode: Node, targetOffset: number): number => {
    const range = document.createRange();
    range.setStartAfter(anchorNode);
    range.setEnd(targetNode, targetOffset);
    return range.toString().length;
};
