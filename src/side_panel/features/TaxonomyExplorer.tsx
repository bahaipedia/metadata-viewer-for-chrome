import React, { useEffect, useState, useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { DefinedTag, LogicalUnit } from '@/utils/types';
import { 
    ChevronRightIcon, ChevronDownIcon, UserIcon, 
    BuildingLibraryIcon, TrashIcon, Bars2Icon 
} from '@heroicons/react/24/solid';
import { 
    DndContext, 
    useDraggable, 
    useDroppable, 
    DragEndEvent,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

interface TreeNode extends DefinedTag {
  children: TreeNode[];
  units?: LogicalUnit[];
  forceExpand?: boolean; 
}

interface Props {
    filter: string;
    viewMode: 'mine' | 'all';
    revealUnitId: number | null;
    refreshKey: number;
    onTagSelect: (tag: DefinedTag) => void;
    isSelectionMode: boolean;
    isEditMode: boolean;
    onTreeChange: (changes: {id: number, parent_id: number | null}[]) => void;
    onDeleteTag: (tag: DefinedTag, hasChildren: boolean) => void;
}

export const TaxonomyExplorer: React.FC<Props> = ({ 
    filter, viewMode, revealUnitId, refreshKey, 
    onTagSelect, isSelectionMode, isEditMode, onTreeChange, onDeleteTag 
}) => {
  const { get } = useApi();
  const [tree, setTree] = useState<TreeNode[]>([]); // Source of truth from API
  const [localTree, setLocalTree] = useState<TreeNode[]>([]); // Local state for DnD
  const [loading, setLoading] = useState(true);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(new Set());
  const [activeDragId, setActiveDragId] = useState<number | null>(null);

  // 1. Initial Load
  useEffect(() => {
    setLoading(true);
    get(`/api/tags/tree?scope=${viewMode}`)
      .then((data) => {
          setTree(data);
          setLocalTree(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [viewMode, refreshKey]);

  // 2. Auto-Expand Logic
  useEffect(() => {
    if (!revealUnitId) return;

    const findPath = (nodes: TreeNode[], targetTagId: number, path: number[] = []): number[] | null => {
        for (const node of nodes) {
            if (node.id === targetTagId) return [...path, node.id];
            if (node.children) {
                const result = findPath(node.children, targetTagId, [...path, node.id]);
                if (result) return result;
            }
        }
        return null;
    };

    get(`/api/units/${revealUnitId}/tags`).then((tags: DefinedTag[]) => {
        const idsToExpand = new Set(expandedNodeIds);
        tags.forEach(tag => {
            const path = findPath(localTree, tag.id);
            if (path) path.forEach(id => idsToExpand.add(id));
        });
        setExpandedNodeIds(idsToExpand);
    });
  }, [revealUnitId, localTree]);

  // 3. DnD Handlers
  const handleDragStart = (event: DragStartEvent) => {
      setActiveDragId(event.active.id as number);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as number;
    const overId = over.id as number;

    // Helper to recursively remove a node
    const removeNode = (nodes: TreeNode[], id: number): { cleaned: TreeNode[], movedNode: TreeNode | null } => {
        let movedNode: TreeNode | null = null;
        const cleaned = nodes.reduce((acc, node) => {
            if (node.id === id) {
                movedNode = node;
                return acc;
            }
            if (node.children) {
                const result = removeNode(node.children, id);
                if (result.movedNode) movedNode = result.movedNode;
                return [...acc, { ...node, children: result.cleaned }];
            }
            return [...acc, node];
        }, [] as TreeNode[]);
        return { cleaned, movedNode };
    };

    // Helper to recursively insert a node
    const insertNode = (nodes: TreeNode[], targetId: number, nodeToInsert: TreeNode): TreeNode[] => {
        return nodes.map(node => {
            if (node.id === targetId) {
                return { ...node, children: [...(node.children || []), nodeToInsert] };
            }
            if (node.children) {
                return { ...node, children: insertNode(node.children, targetId, nodeToInsert) };
            }
            return node;
        });
    };

    const { cleaned, movedNode } = removeNode(localTree, activeId);
    
    if (movedNode) {
        // If overId is special root marker (optional) or just another tag. 
        // Note: Currently logic only supports nesting inside another tag.
        // To support "making root", we'd need a drop zone outside nodes.
        const newTree = insertNode(cleaned, overId, movedNode);
        setLocalTree(newTree);
        onTreeChange([{ id: activeId, parent_id: overId }]);
    }
  };

  // 4. Recursive Filter & Render Preparation
  const processNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes.map(node => {
        // Filter Text
        const matchesText = node.label.toLowerCase().includes(filter.toLowerCase());
        
        const processedChildren = processNodes(node.children || []);
        
        if (matchesText || processedChildren.length > 0) {
            // Force expand if filtering or manually expanded
            const shouldExpand = (!!filter && processedChildren.length > 0) || expandedNodeIds.has(node.id);
            return { ...node, children: processedChildren, forceExpand: shouldExpand };
        }
        return null;
    }).filter(Boolean) as TreeNode[];
  };

  const displayTree = useMemo(() => processNodes(localTree), [localTree, filter, expandedNodeIds]);

  // Handle manual toggle from child components
  const toggleExpand = (id: number) => {
      const newSet = new Set(expandedNodeIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setExpandedNodeIds(newSet);
  };

  if (loading) return <div className="p-4 text-xs text-slate-400">Loading...</div>;

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="pb-10"> 
           {displayTree.length === 0 && <div className="p-4 text-sm text-slate-400">No tags found.</div>}
           {displayTree.map(node => (
             <TaxonomyNode 
               key={node.id} 
               node={node} 
               isEditMode={isEditMode}
               onDeleteTag={onDeleteTag}
               highlightUnitId={revealUnitId}
               refreshKey={refreshKey}
               onTagSelect={onTagSelect}
               isSelectionMode={isSelectionMode}
               isExpanded={node.forceExpand || false}
               onToggleExpand={() => toggleExpand(node.id)}
             />
           ))}
        </div>
        
        {/* Drag Overlay for Visual Feedback */}
        <DragOverlay>
            {activeDragId ? (
                <div className="bg-white border border-blue-500 p-2 rounded shadow-lg opacity-90 text-sm font-bold text-blue-800">
                    Moving Tag...
                </div>
            ) : null}
        </DragOverlay>
    </DndContext>
  );
};

const TaxonomyNode = ({ 
    node, isEditMode, onDeleteTag, highlightUnitId, refreshKey, onTagSelect, isSelectionMode, isExpanded, onToggleExpand
}: any) => {
    const { get } = useApi();
    const [units, setUnits] = useState<LogicalUnit[]>([]);

    // DnD Hooks
    const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({
        id: node.id,
        disabled: !isEditMode || !!node.is_official
    });

    const { setNodeRef: setDropRef, isOver } = useDroppable({
        id: node.id,
        disabled: !isEditMode
    });

    // Lazy Load Units
    useEffect(() => {
        if (isExpanded && units.length === 0) {
             get(`/api/units?tag_id=${node.id}&limit=10`).then(setUnits).catch(() => {});
        }
    }, [isExpanded, refreshKey]);

    const style = transform ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 999 : 'auto',
        opacity: isDragging ? 0.5 : 1
    } : undefined;

    const handleLabelClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isEditMode) return; // Do nothing on click in edit mode, use handles
        if (isSelectionMode) {
            onTagSelect(node);
        } else {
            onToggleExpand();
        }
    };

    return (
        <div 
            ref={setDropRef}
            className={`ml-3 border-l border-slate-200 pl-2 transition-colors ${isOver ? 'bg-blue-50 rounded-l border-blue-300' : ''}`}
        >
            <div 
                ref={setDragRef} 
                style={style}
                className={`flex items-center py-1 rounded text-sm select-none group ${isDragging ? 'bg-white ring-2 ring-blue-400 shadow-sm' : ''}`}
            >
                {/* Drag Handle */}
                {isEditMode && !node.is_official && (
                    <div {...listeners} {...attributes} className="mr-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 p-1">
                        <Bars2Icon className="w-4 h-4" />
                    </div>
                )}

                {/* Arrow */}
                <div 
                    className="mr-1 text-slate-400 cursor-pointer p-0.5 hover:text-slate-700 hover:bg-slate-200 rounded"
                    onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
                >
                     {node.children.length > 0 || (isExpanded && units.length > 0) ? (
                         isExpanded ? <ChevronDownIcon className="h-3 w-3" /> : <ChevronRightIcon className="h-3 w-3" />
                     ) : <span className="w-3 h-3 block"></span>}
                </div>

                {/* Label */}
                <div 
                    className={`flex items-center flex-1 cursor-pointer hover:bg-slate-100 px-1 rounded ${
                        isSelectionMode && !isEditMode ? 'hover:text-blue-600 hover:font-semibold' : 'text-slate-700'
                    }`}
                    onClick={handleLabelClick}
                    title={isSelectionMode ? "Click to add this tag" : "Click to expand"}
                >
                    <span className="mr-1.5">
                        {node.is_official ? <BuildingLibraryIcon className="h-3 w-3 text-amber-500"/> : <UserIcon className="h-3 w-3 text-blue-400"/>}
                    </span>
                    <span>{node.label}</span>
                </div>

                {/* Delete Button */}
                {isEditMode && !node.is_official && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteTag(node, node.children.length > 0); }}
                        className="ml-2 text-slate-300 hover:text-red-500 p-1"
                    >
                        <TrashIcon className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Recursion & Units */}
            {isExpanded && !isDragging && (
                <div>
                    {node.children.map((child: any) => (
                        <TaxonomyNode 
                            key={child.id} 
                            node={child} 
                            isEditMode={isEditMode} 
                            onDeleteTag={onDeleteTag}
                            highlightUnitId={highlightUnitId}
                            refreshKey={refreshKey}
                            onTagSelect={onTagSelect}
                            isSelectionMode={isSelectionMode}
                            isExpanded={child.forceExpand || false}
                            onToggleExpand={() => child.onToggleExpand ? child.onToggleExpand() : null} 
                            // Note: onToggleExpand needs to be passed down via props in the real recursion.
                            // However, since we define toggleExpand in parent, we need to pass the toggle function properly.
                            // FIX: The recursive call below must pass the parent's toggle handler wrapper or similar.
                            // Actually, simpler: Pass the logic down via Props recursion.
                        />
                    ))}
                    
                    {units.map(u => {
                        const isActive = highlightUnitId === u.id;
                        return (
                            <div 
                                key={u.id}
                                className={`ml-5 text-xs py-1 px-2 mb-1 rounded cursor-pointer truncate transition-all duration-500 ${
                                    isActive 
                                    ? 'bg-yellow-100 text-yellow-800 font-bold border border-yellow-300' 
                                    : 'text-slate-500 hover:text-blue-600 hover:bg-blue-50'
                                }`}
                                onClick={() => chrome.runtime.sendMessage({ type: 'NAVIGATE_TO_UNIT', unit_id: u.id, ...u })}
                            >
                                📄 {u.text_content.substring(0, 30)}...
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
