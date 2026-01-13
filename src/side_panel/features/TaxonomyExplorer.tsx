import React, { useEffect, useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { DefinedTag, LogicalUnit } from '@/utils/types';
import { ChevronRightIcon, ChevronDownIcon, MagnifyingGlassIcon } from '@heroicons/react/24/solid';

// Extended type for tree logic
interface TreeNode extends DefinedTag {
  children: TreeNode[];
  units?: LogicalUnit[]; // Loaded on demand or preloaded
}

export const TaxonomyExplorer = () => {
  const { get } = useApi();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Mock API call - replace with actual endpoint
    get('/api/tags/tree')
      .then((data) => setTree(data))
      .catch((err) => console.error("Failed to load taxonomy", err))
      .finally(() => setLoading(false));
  }, []);

  // Recursive Filter Logic
  const filterNodes = (nodes: TreeNode[], query: string): TreeNode[] => {
    return nodes
      .map(node => {
        const matchesSelf = node.label.toLowerCase().includes(query.toLowerCase());
        const filteredChildren = filterNodes(node.children || [], query);
        
        if (matchesSelf || filteredChildren.length > 0) {
          return { ...node, children: filteredChildren, forceExpand: !!query }; // Auto-expand on search
        }
        return null;
      })
      .filter(Boolean) as TreeNode[];
  };

  const displayTree = filter ? filterNodes(tree, filter) : tree;

  return (
    <div className="flex flex-col h-full">
      {/* SEARCH HEADER */}
      <div className="p-4 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Filter tags..." 
            className="w-full pl-8 pr-2 py-2 text-sm border rounded bg-slate-50 focus:bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      {/* TREE CONTENT */}
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
            <div className="text-center text-slate-400 mt-10">Loading Taxonomy...</div>
        ) : (
            displayTree.map(node => <TaxonomyNode key={node.id} node={node} />)
        )}
      </div>
    </div>
  );
};

// Recursive Node Component
const TaxonomyNode = ({ node }: { node: TreeNode & { forceExpand?: boolean } }) => {
  const { get } = useApi();
  const [expanded, setExpanded] = useState(node.forceExpand || false);
  const [units, setUnits] = useState<LogicalUnit[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);

  // Sync expansion if search forces it
  useEffect(() => {
    if (node.forceExpand) setExpanded(true);
  }, [node.forceExpand]);

  const handleToggle = async () => {
    setExpanded(!expanded);
    
    // Lazy Load units if expanding and not yet loaded
    if (!expanded && units.length === 0) {
        setLoadingUnits(true);
        try {
            // Fetch units for this specific tag
            const data = await get(`/api/units?tag_id=${node.id}&limit=5`); 
            setUnits(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingUnits(false);
        }
    }
  };

  const handleUnitClick = (unit: LogicalUnit) => {
      // Send message to background to navigate/scroll
      chrome.runtime.sendMessage({ 
          type: 'NAVIGATE_TO_UNIT', 
          source_code: unit.source_code, 
          source_page_id: unit.source_page_id,
          unit_id: unit.id 
      });
  };

  return (
    <div className="ml-2">
      {/* Node Label */}
      <div 
        className="flex items-center py-1 cursor-pointer hover:bg-slate-100 rounded text-sm text-slate-700 select-none"
        onClick={handleToggle}
      >
        <span className="mr-1 text-slate-400">
          {node.children.length > 0 ? (
             expanded ? <ChevronDownIcon className="h-4 w-4" /> : <ChevronRightIcon className="h-4 w-4" />
          ) : (
             <span className="w-4 h-4 inline-block" /> // spacer
          )}
        </span>
        <span className="font-medium">{node.label}</span>
      </div>

      {/* Children & Units */}
      {expanded && (
        <div className="ml-4 border-l border-slate-200 pl-2">
          
          {/* 1. Associated Units (Preview) */}
          {loadingUnits && <div className="text-xs text-slate-400 py-1">Loading items...</div>}
          
          {units.map(unit => (
              <div 
                key={`u-${unit.id}`} 
                onClick={() => handleUnitClick(unit)}
                className="text-xs text-slate-500 py-1 px-2 hover:bg-blue-50 hover:text-blue-600 cursor-pointer truncate border-b border-slate-100 last:border-0"
                title={unit.text_content}
              >
                  📄 "{unit.text_content.substring(0, 40)}..."
              </div>
          ))}

          {/* 2. Nested Tags */}
          {node.children.map(child => (
            <TaxonomyNode key={child.id} node={{...child, forceExpand: node.forceExpand}} />
          ))}
        </div>
      )}
    </div>
  );
};
