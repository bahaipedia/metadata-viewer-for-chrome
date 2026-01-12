import React, { useState, useEffect } from 'react';
import { useApi } from '@/hooks/useApi';

interface Tag {
  id: number;
  label: string;
}

interface Props {
  selectedTags: number[];
  onChange: (tagIds: number[]) => void;
}

export const TagInput: React.FC<Props> = ({ selectedTags, onChange }) => {
  const { get } = useApi();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Tag[]>([]);
  const [displayTags, setDisplayTags] = useState<Tag[]>([]); // To show labels for selected IDs

  // 1. Search Tags (Debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        // You need to create this endpoint in your Express API
        const results = await get(`/api/tags?search=${encodeURIComponent(query)}`);
        setSuggestions(results);
      } catch (e) {
        console.error("Tag fetch failed", e);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const addTag = (tag: Tag) => {
    if (!selectedTags.includes(tag.id)) {
      onChange([...selectedTags, tag.id]);
      setDisplayTags([...displayTags, tag]);
    }
    setQuery('');
    setSuggestions([]);
  };

  const removeTag = (id: number) => {
    onChange(selectedTags.filter(t => t !== id));
    setDisplayTags(displayTags.filter(t => t.id !== id));
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold text-slate-600 mb-1">TAGS</label>
      
      {/* Selected Tags List */}
      <div className="flex flex-wrap gap-1 mb-2">
        {displayTags.map(tag => (
          <span key={tag.id} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center">
            {tag.label}
            <button 
              onClick={() => removeTag(tag.id)}
              className="ml-1 text-blue-600 hover:text-blue-900 font-bold"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input */}
      <input
        type="text"
        className="w-full p-2 text-sm border rounded bg-white"
        placeholder="Type to search tags..."
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {/* Dropdown Results */}
      {suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-slate-200 rounded shadow-lg mt-1 max-h-32 overflow-y-auto">
          {suggestions.map(tag => (
            <li 
              key={tag.id}
              onClick={() => addTag(tag)}
              className="px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer text-slate-700"
            >
              {tag.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
