import React, { useState } from 'react';
import { FolderIcon, FolderOpenIcon, ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

interface BottomPageSectionProps {
  label: string;
  children: React.ReactNode;
}

export const BottomPageSection: React.FC<BottomPageSectionProps> = ({
  label,
  children
}) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="border-t-2 border-blue-500 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 flex flex-col max-h-[38%] flex-shrink-0 dark:bg-slate-900 dark:border-blue-600">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600 hover:text-slate-800 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-slate-100 flex-shrink-0"
      >
        <span>{label}</span>
        {open ? <ChevronDownIcon className="w-3.5 h-3.5" /> : <ChevronRightIcon className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="p-2.5 space-y-1.5 overflow-y-auto">
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
    <div className="ml-3 pl-2 transition-colors duration-300 rounded-lg">
      <div
        onClick={onToggle}
        className={`flex items-center py-1.5 px-2 rounded cursor-pointer select-none group transition-colors mb-0.5 ${
          isOpen
            ? 'text-blue-500 font-medium dark:text-blue-400'
            : 'text-slate-700 dark:text-slate-300'
        }`}
        title="Toggle Folder"
      >
        <div className="w-6 flex items-center justify-center mr-1 flex-shrink-0">
          {isOpen ? (
            <FolderOpenIcon className="w-5 h-5 text-blue-500" />
          ) : (
            <FolderIcon className="w-4 h-4 text-blue-400" />
          )}
        </div>
        <div className="flex-1 text-sm truncate">{label}</div>
        <span className="ml-2 text-[10px] text-slate-400 dark:text-slate-500">
          {count}
        </span>
      </div>

      {isOpen && (
        <div className="mt-1 space-y-0.5">
          {children}
        </div>
      )}
    </div>
  );
};

