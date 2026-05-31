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
  highlighted: boolean;
  onBuildOn: (question: Question) => void;
  onVoteChange: (questionId: string, voted: boolean) => void;
}

function timeAgo(iso: string, lang: Lang): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return lang === 'ja' ? 'たった今' : 'just now';
  if (mins < 60) return lang === 'ja' ? `${mins}分前` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return lang === 'ja' ? `${hrs}時間前` : `${hrs}h`;
  return lang === 'ja' ? `${Math.floor(hrs / 24)}日前` : `${Math.floor(hrs / 24)}d`;
}

export default function QuestionRow({
  question, voterId, lang, highlighted, onBuildOn, onVoteChange,
}: Props) {
  const t = i18n[lang].board;
  const [contextOpen, setContextOpen] = useState(false);

  return (
    <div
      id={`note-${question.id}`}
      className={`border-b border-slate-100 transition-colors duration-700 ${
        highlighted
          ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400'
          : 'hover:bg-slate-50/70'
      }`}
    >
      <div className="flex items-start gap-3 px-4 py-2">
        {/* Vote */}
        <div className="shrink-0 pt-0.5">
          <VoteButton
            questionId={question.id}
            voteCount={question.vote_count}
            votedByMe={question.voted_by_me ?? false}
            voterId={voterId}
            lang={lang}
            onVoteChange={onVoteChange}
          />
        </div>

        {/* Category */}
        <div className="shrink-0 pt-0.5">
          <CategoryBadge category={question.category} lang={lang} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5 pt-0.5">
          {/* Parent thread indicator */}
          {question.parent && (
            <p className="text-xs text-slate-400 line-clamp-1">
              <span className="mr-1 not-italic">↳</span>
              <span className="italic">{question.parent.content}</span>
            </p>
          )}
          {/* Question text — 2 lines max */}
          <p className="text-sm text-slate-800 font-medium leading-snug line-clamp-2">
            {question.content}
          </p>
        </div>

        {/* Right meta + actions */}
        <div className="shrink-0 flex items-center gap-3 pt-1 text-xs text-slate-400 whitespace-nowrap">
          <span className="hidden lg:block truncate max-w-[160px]">
            {question.author_name}
            <span className="text-slate-300 mx-1">·</span>
            {question.author_affiliation}
          </span>
          <span className="text-slate-300">{timeAgo(question.created_at, lang)}</span>
          {question.context && (
            <button
              onClick={() => setContextOpen(o => !o)}
              className="text-slate-400 hover:text-indigo-600 transition-colors font-medium"
            >
              {contextOpen ? t.hideContext : t.context}
            </button>
          )}
          <button
            onClick={() => onBuildOn(question)}
            className="text-slate-400 hover:text-indigo-600 font-medium transition-colors"
          >
            + {t.buildOn}
          </button>
        </div>
      </div>

      {/* Inline context expansion */}
      {question.context && contextOpen && (
        <div
          className="mx-4 mb-2 bg-amber-50/70 rounded-lg border border-amber-100 px-4 py-2.5"
          style={{ borderLeft: '3px solid #F59E0B' }}
        >
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide block mb-1">
            {t.context}
          </span>
          <p className="text-xs text-slate-600 leading-relaxed">{question.context}</p>
        </div>
      )}
    </div>
  );
}
