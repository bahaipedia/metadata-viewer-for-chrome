import React, { useState } from 'react';
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

interface PinnedPageSectionProps {
  label: string;
  accent?: 'blue' | 'slate' | 'emerald';
  children: React.ReactNode;
}

export const PinnedPageSection: React.FC<PinnedPageSectionProps> = ({
  label,
  accent = 'blue',
  children
}) => {
  const [open, setOpen] = useState(true);

  const containerClasses =
    accent === 'blue'
      ? 'bg-blue-50 border-blue-100 dark:bg-slate-900 dark:border-slate-700'
      : accent === 'emerald'
      ? 'bg-emerald-50/70 border-emerald-100 dark:bg-slate-900 dark:border-slate-700'
      : 'bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-700';

  const headerClasses =
    accent === 'blue'
      ? 'text-blue-800 border-blue-200 dark:text-blue-300 dark:border-slate-700'
      : accent === 'emerald'
      ? 'text-emerald-800 border-emerald-200 dark:text-emerald-300 dark:border-slate-700'
      : 'text-slate-600 border-slate-200 dark:text-slate-300 dark:border-slate-700';

  return (
    <div className={`rounded border p-2.5 flex-shrink-0 ${containerClasses}`}>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wide ${
          open ? `border-b pb-1.5 mb-2 ${headerClasses}` : headerClasses
        }`}
      >
        <span>{label}</span>
        {open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {children}
        </div>
      )}
    </div>
  );
};

interface DirectoryFolderProps {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export const DirectoryFolder: React.FC<DirectoryFolderProps> = ({
  label,
  count,
  isOpen,
  onToggle,
  children
}) => {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center py-1.5 px-2 rounded text-left select-none transition-colors hover:bg-slate-100 dark:hover:bg-slate-800/70 ${
          isOpen ? 'text-blue-600 font-medium dark:text-blue-400' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        <div className="w-5 flex items-center justify-center mr-1.5 flex-shrink-0">
          {isOpen ? (
            <FolderOpenIcon className="w-4 h-4 text-blue-500" />
          ) : (
            <FolderIcon className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <span className="flex-1 text-xs truncate">{label}</span>
        <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {count}
        </span>
      </button>

      {isOpen && (
        <div className="ml-3 pl-2.5 border-l border-slate-200 dark:border-slate-800 space-y-1.5 mt-1 mb-2">
          {children}
        </div>
      )}
    </div>
  );
};
