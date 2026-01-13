import React, { useState, useEffect } from 'react';
import { useSelection } from '@/side_panel/context/SelectionContext';
import { useApi } from '@/hooks/useApi';
import { LogicalUnit, PageMetadata } from '@/utils/types';

type StagedAnswer = 
  | { type: 'existing', unit: LogicalUnit }
  | { type: 'new', text: string, offsets: { start: number, end: number }, context: PageMetadata };

export const QAManager = () => {
  const { currentSelection, selectedUnit, clearSelection } = useSelection();
  const { post, del } = useApi(); // Added 'del' for the DELETE operation

  const [questionText, setQuestionText] = useState('');
  const [author, setAuthor] = useState("‘Abdu’l-Bahá");
  const [answer, setAnswer] = useState<StagedAnswer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill form if user clicks a green "Canonical Answer" highlight
  useEffect(() => {
    if (selectedUnit && selectedUnit.unit_type === 'canonical_answer') {
      setAnswer({ type: 'existing', unit: selectedUnit });
      // Ideally fetch the existing question text here via API if available
      // setQuestionText(fetchedQuestion); 
    }
  }, [selectedUnit]);

  const handleSetAnswer = () => {
    if (selectedUnit) {
      setAnswer({ type: 'existing', unit: selectedUnit });
      clearSelection();
    } else if (currentSelection) {
      setAnswer({ type: 'new', ...currentSelection });
      clearSelection();
    }
  };

  const handleSetQuestionFromText = () => {
    if (currentSelection) setQuestionText(currentSelection.text);
    else if (selectedUnit) setQuestionText(selectedUnit.text_content);
  };

  const handleSubmit = async () => {
    if (!questionText || !answer) return;
    setIsSubmitting(true);

    try {
      // 1. IF UPDATING: Delete the old unit first.
      // This triggers the DB Cascade to delete the old canonical_question too.
      if (answer.type === 'existing') {
        await del(`/api/units/${answer.unit.id}`);
      }

      // 2. Create the NEW Logical Unit (New ID for RAG safety)
      // Note: Even if we are "updating", we treat the text as new content now.
      const textToSave = answer.type === 'existing' ? answer.unit.text_content : answer.text;
      const offsets = answer.type === 'existing' 
        ? { start: answer.unit.start_char_index, end: answer.unit.end_char_index }
        : answer.offsets;
      const context = answer.type === 'existing' 
        // We need to grab context from the existing unit if we don't have it handy, 
        // but typically 'existing' unit has source_code/page_id embedded or we grab from global page context.
        // Assuming your LogicalUnit type has source info, or we use current page context:
        ? { source_code: answer.unit.source_code, source_page_id: answer.unit.source_page_id } 
        : answer.context;

      const unitRes = await post('/api/contribute/unit', {
        source_code: context.source_code,
        source_page_id: context.source_page_id,
        text_content: textToSave,
        start_char_index: offsets.start,
        end_char_index: offsets.end,
        author: author,
        unit_type: "canonical_answer"
      });

      // 3. Create the NEW Canonical Question linked to the NEW Unit
      await post('/api/contribute/qa', {
        question_text: questionText,
        answer_unit_id: unitRes.unit_id,
        source_book: context.source_code 
      });

      alert("Q&A Pair Saved!");
      setQuestionText('');
      setAnswer(null);
      clearSelection();
      chrome.tabs.reload(); 

    } catch (e: any) {
      console.error(e);
      alert("Error saving Q&A: " + (e.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-lg font-bold text-slate-800">Q&A Builder</h2>

      {/* QUESTION INPUT */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-500">QUESTION</label>
        <div className="relative">
            <textarea 
            className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 min-h-[80px]"
            placeholder="Type the question here..."
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            />
            <button 
                type="button"
                onClick={handleSetQuestionFromText}
                disabled={!currentSelection && !selectedUnit}
                className="absolute top-2 right-2 text-[10px] bg-slate-100 border border-slate-300 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-0 transition-opacity"
            >
                Paste Selection
            </button>
        </div>
      </div>

      {/* AUTHOR DROPDOWN */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">ANSWER AUTHOR</label>
        <select 
          className="w-full p-2 text-sm border rounded bg-white"
          value={author}
          onChange={e => setAuthor(e.target.value)}
        >
          <option>Bahá’u’lláh</option>
          <option>The Báb</option>
          <option>‘Abdu’l-Bahá</option>
          <option>Shoghi Effendi</option>
          <option>Universal House of Justice</option>
        </select>
      </div>

      <div className="h-px bg-slate-200 my-2"></div>

      {/* ANSWER INPUT */}
      <div className={`p-3 rounded border ${answer ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-500">ANSWER (Highlight Text)</span>
          {answer && <button onClick={() => setAnswer(null)} className="text-xs text-red-500 hover:underline">Clear</button>}
        </div>

        {answer ? (
          <p className="text-sm line-clamp-4 italic">"{answer.type === 'existing' ? answer.unit.text_content : answer.text}"</p>
        ) : (
          <button 
            onClick={handleSetAnswer}
            disabled={!currentSelection && !selectedUnit}
            className="w-full py-2 text-sm bg-white border border-slate-300 rounded text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            {currentSelection || selectedUnit ? "Set Active Selection as Answer" : "Highlight text to select..."}
          </button>
        )}
      </div>

      {/* SUBMIT */}
      <button 
        onClick={handleSubmit}
        disabled={!questionText || !answer || isSubmitting}
        className="w-full py-3 bg-slate-800 text-white font-bold rounded shadow-lg hover:bg-slate-700 disabled:bg-slate-300"
      >
        {isSubmitting ? "Saving..." : "Save Q&A Pair"}
      </button>
    </div>
  );
};
