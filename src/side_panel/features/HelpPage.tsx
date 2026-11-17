import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/solid';

type HelpSection = 'overview' | 'tags' | 'label' | 'qa' | 'link';

const SECTIONS: { id: HelpSection; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tags', label: 'Tags' },
  { id: 'label', label: 'Label' },
  { id: 'qa', label: 'Q&A' },
  { id: 'link', label: 'Link' },
];

export const HelpPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fromPath = searchParams.get('from') || '/';

  const resolveSection = (raw: string | null): HelpSection => {
    if (raw === 'tags' || raw === 'label' || raw === 'qa' || raw === 'link' || raw === 'overview') {
      return raw;
    }
    return 'overview';
  };

  const [activeSection, setActiveSection] = useState<HelpSection>(() =>
    resolveSection(searchParams.get('section'))
  );

  useEffect(() => {
    setActiveSection(resolveSection(searchParams.get('section')));
  }, [searchParams]);

  const selectSection = (section: HelpSection) => {
    setActiveSection(section);
    setSearchParams({ section, from: fromPath }, { replace: true });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="p-3 bg-white border-b border-slate-200 shadow-sm z-10 space-y-3 dark:bg-slate-900 dark:border-slate-800">
        <div className="flex items-center gap-2 mr-20">
          <button
            type="button"
            onClick={() => navigate(fromPath)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <ArrowLeftIcon className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Extension Guide
          </span>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg dark:bg-slate-800">
          {SECTIONS.map((sec) => (
            <button
              key={sec.id}
              type="button"
              onClick={() => selectSection(sec.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeSection === sec.id
                  ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {activeSection === 'overview' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Getting Started (Placeholder)
            </h3>
            <p>
              The Bahá’í Text Annotation Tool works alongside supported sites such as{' '}
              <b>bahai.org/library</b> and <b>bahai.works</b> to organize passages, identify works inside periodicals, pair authoritative Q&A, and connect related Writings.
            </p>
            <p>
              Logged-out visitors can explore a complete read-only example collection across all four tabs—clicking any item navigates directly to its source page and highlights the passage.
            </p>
            <p>
              To start cataloging on your own, open the <b>Settings</b> gear in the top right and log in using a Bot Password from <b>Special:BotPasswords</b> on Bahai.works.
            </p>
          </div>
        )}

        {activeSection === 'tags' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Tags Tab (Placeholder)
            </h3>
            <p>
              Use <b>Tags</b> to highlight passages on supported pages and organize them into a personal folder hierarchy or flat topic list.
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>Expand any folder and click a snippet to jump straight to that passage on the page.</li>
              <li>When logged in, highlight text on a page to assign existing tags or create new ones.</li>
              <li>Click the pencil button next to the filter box to rename, delete, or drag-and-drop folders into sub-categories.</li>
            </ul>
          </div>
        )}

        {activeSection === 'label' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Label Tab (Placeholder)
            </h3>
            <p>
              Use <b>Label</b> when reading periodicals or compilations (such as <i>Star of the West</i> or <i>Bahá’í News</i>) to mark the boundaries of individual Tablets, Prayers, Talks, or Historical Accounts.
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>Browse all labeled works by publication, or filter by keyword, author, or type.</li>
              <li>When viewing a page that already has labeled items, a summary drawer appears at the bottom of the tab.</li>
              <li>When logged in, highlight a passage on a supported page to save a new label.</li>
            </ul>
          </div>
        )}

        {activeSection === 'qa' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Q&A Tab (Placeholder)
            </h3>
            <p>
              Use <b>Q&A</b> to pair specific questions with authoritative answers found in the Bahá’í Writings (for example, in <i>Some Answered Questions</i> or letters of the Guardian and Universal House of Justice).
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>Browse existing Q&A pairs grouped by source book and click any entry to jump to the answer.</li>
              <li>When logged in, highlight an answer on a page (or click the <b>+</b> button next to the filter bar) to record a question and its answer.</li>
            </ul>
          </div>
        )}

        {activeSection === 'link' && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Link Tab (Placeholder)
            </h3>
            <p>
              Use <b>Link</b> to connect two related passages across the Writings—such as linking a commentary, translation, refutation, or allusion (Subject) to the passage it refers to (Object).
            </p>
            <ul className="list-disc pl-4 space-y-1.5">
              <li>Expand any relationship category and click either the <b>Subject</b> or <b>Object</b> section to jump directly to that text.</li>
              <li>When logged in, highlight text on a page to set the Subject, navigate to the target passage to set the Object, and save the connection.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
