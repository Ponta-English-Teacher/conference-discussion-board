'use client';

import { useState } from 'react';
import type { Question, Lang } from '@/types';
import CategoryBadge from './CategoryBadge';
import VoteButton from './VoteButton';
import { i18n } from '@/lib/i18n';

interface Props {
  question: Question;
  voterId: string;
  lang: Lang;
  onBuildOn: (question: Question) => void;
  onVoteChange: (questionId: string, voted: boolean) => void;
}

const ACCENT_COLORS = [
  '#6366F1', '#14B8A6', '#8B5CF6', '#F59E0B',
  '#F43F5E', '#10B981', '#0EA5E9', '#F97316',
];

function accentForId(id: string): string {
  const hash = id.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  return ACCENT_COLORS[hash % ACCENT_COLORS.length];
}

export default function StickyNote({ question, voterId, lang, onBuildOn, onVoteChange }: Props) {
  const t = i18n[lang].board;
  const [contextOpen, setContextOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const accentColor = question.category_id ? accentForId(question.category_id) : '#CBD5E1';
  const longContent = question.content.length > 120;

  return (
    <div
      id={`note-${question.id}`}
      className="break-inside-avoid mb-3 bg-amber-50 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 p-3 flex flex-col gap-2"
      style={{
        border: '1px solid rgba(251, 191, 36, 0.25)',
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      {/* Top row: category badge + vote button */}
      <div className="flex items-center justify-between gap-2">
        <CategoryBadge category={question.category} lang={lang} />
        <VoteButton
          questionId={question.id}
          voteCount={question.vote_count}
          votedByMe={question.voted_by_me ?? false}
          voterId={voterId}
          lang={lang}
          onVoteChange={onVoteChange}
        />
      </div>

      {/* Parent reference */}
      {question.parent && (
        <div className="text-xs text-slate-400 bg-white/70 border border-amber-100 rounded-lg px-2.5 py-1.5 italic line-clamp-1 leading-relaxed">
          <span className="not-italic font-medium text-slate-400 mr-1">{t.buildingOn}</span>
          {question.parent.content}
        </div>
      )}

      {/* Content */}
      <p className={`text-sm text-slate-800 leading-snug font-medium ${longContent && !expanded ? 'line-clamp-3' : ''}`}>
        {question.content}
      </p>
      {longContent && (
        <button
          onClick={() => setExpanded(o => !o)}
          className="self-start text-xs text-slate-400 hover:text-indigo-600 transition-colors"
        >
          {expanded
            ? (lang === 'ja' ? '閉じる ▲' : 'show less ▲')
            : (lang === 'ja' ? '続きを読む ▼' : 'show more ▼')}
        </button>
      )}

      {/* Context (expanded on demand) */}
      {question.context && contextOpen && (
        <div className="bg-white/80 rounded-lg border border-amber-100 px-3 py-2 flex flex-col gap-1">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {t.context}
          </span>
          <p className="text-xs text-slate-600 leading-relaxed">{question.context}</p>
        </div>
      )}

      {/* Footer: author · context toggle · build on */}
      <div className="flex items-center gap-2 pt-1 border-t border-amber-100">
        <p className="text-xs text-slate-400 flex items-center gap-1 min-w-0 flex-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-slate-300 shrink-0" />
          <span className="truncate">{question.author_name}</span>
          <span className="text-slate-300 shrink-0">·</span>
          <span className="truncate">{question.author_affiliation}</span>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {question.context && (
            <button
              onClick={() => setContextOpen(o => !o)}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors font-medium whitespace-nowrap"
            >
              {contextOpen ? t.hideContext : t.showContext}
            </button>
          )}
          <button
            onClick={() => onBuildOn(question)}
            className="text-xs text-slate-400 hover:text-indigo-600 font-medium transition-colors whitespace-nowrap"
          >
            + {t.buildOn}
          </button>
        </div>
      </div>
    </div>
  );
}
