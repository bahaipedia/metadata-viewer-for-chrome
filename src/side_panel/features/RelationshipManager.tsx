import React, { useState } from 'react';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useApi } from '@/hooks/useApi';
import { LogicalUnit, PageMetadata } from '@/utils/types';

// Helper type to hold either a ready ID or raw data to create one
type StagedItem = 
  | { type: 'existing', unit: LogicalUnit }
  | { type: 'new', text: string, offsets: { start: number, end: number }, context: PageMetadata };

export const RelationshipManager = () => {
  const { currentSelection, selectedUnit } = useSelection();
  const { post } = useApi();
  
  const [subject, setSubject] = useState<StagedItem | null>(null);
  const [object, setObject] = useState<StagedItem | null>(null);
  const [relType, setRelType] = useState('commentary');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper: Grab what is currently selected in the browser
  const captureSelection = (): StagedItem | null => {
    if (selectedUnit) return { type: 'existing', unit: selectedUnit };
    if (currentSelection) return { type: 'new', ...currentSelection };
    return null;
  };

  const handleSubmit = async () => {
    if (!subject || !object) return;
    setIsSubmitting(true);

    try {
      // 1. Resolve Subject ID (Create if needed)
      let subjectId = subject.type === 'existing' ? subject.unit.id : null;
      if (!subjectId && subject.type === 'new') {
        const res = await post('/api/contribute/unit', {
          source_code: subject.context.source_code,
          source_page_id: subject.context.source_page_id,
          text_content: subject.text,
          start_char_index: subject.offsets.start,
          end_char_index: subject.offsets.end,
          author: "Unknown", // Default or prompt user
          unit_type: "other"
        });
        subjectId = res.id;
      }

      // 2. Resolve Object ID (Create if needed)
      let objectId = object.type === 'existing' ? object.unit.id : null;
      if (!objectId && object.type === 'new') {
        const res = await post('/api/contribute/unit', {
          source_code: object.context.source_code,
          source_page_id: object.context.source_page_id,
          text_content: object.text,
          start_char_index: object.offsets.start,
          end_char_index: object.offsets.end,
          author: "Unknown",
          unit_type: "other"
        });
        objectId = res.id;
      }

      // 3. Create Relationship
      await post('/api/contribute/relationship', {
        subject_unit_id: subjectId,
        object_unit_id: objectId,
        relationship_type: relType
      });

      alert("Relationship Linked!");
      setSubject(null);
      setObject(null);
      chrome.tabs.reload(); // Refresh to show new units

    } catch (e: any) {
      alert("Error linking: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Knowledge Linker</h2>
      
      {/* SUBJECT CARD */}
      <div className={`p-3 rounded border ${subject ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-500">SUBJECT (Origin)</span>
          {subject && <button onClick={() => setSubject(null)} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>
        
        {subject ? (
          <p className="text-sm line-clamp-3 italic">"{subject.type === 'existing' ? subject.unit.text_content : subject.text}"</p>
        ) : (
          <button 
            onClick={() => setSubject(captureSelection())}
            disabled={!currentSelection && !selectedUnit}
            className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Set Current Selection
          </button>
        )}
      </div>

      {/* RELATIONSHIP TYPE */}
      <div className="flex items-center gap-2">
        <div className="h-px bg-slate-200 flex-1"></div>
        <select 
          value={relType} 
          onChange={(e) => setRelType(e.target.value)}
          className="text-sm border-slate-300 rounded p-1 bg-white"
        >
          <option value="commentary">Commentary on</option>
          <option value="translation">Translation of</option>
          <option value="refutation">Refutation of</option>
          <option value="allusion">Allusion to</option>
        </select>
        <div className="h-px bg-slate-200 flex-1"></div>
      </div>

      {/* OBJECT CARD */}
      <div className={`p-3 rounded border ${object ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-500">OBJECT (Target)</span>
          {object && <button onClick={() => setObject(null)} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>

        {object ? (
          <p className="text-sm line-clamp-3 italic">"{object.type === 'existing' ? object.unit.text_content : object.text}"</p>
        ) : (
          <button 
            onClick={() => setObject(captureSelection())}
            disabled={!currentSelection && !selectedUnit}
            className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            Set Current Selection
          </button>
        )}
      </div>

      {/* SUBMIT */}
      <button 
        onClick={handleSubmit}
        disabled={!subject || !object || isSubmitting}
        className="w-full py-3 bg-slate-800 text-white font-bold rounded shadow-lg hover:bg-slate-700 disabled:bg-slate-300"
      >
        {isSubmitting ? "Linking..." : "Create Connection"}
      </button>
    </div>
  );
};
