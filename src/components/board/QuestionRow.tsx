'use client';

import { useState } from 'react';
import type { Question, Lang } from '@/types';
import CategoryBadge from './CategoryBadge';
import { i18n } from '@/lib/i18n';

interface Props {
  question: Question;
  voterId: string;
  lang: Lang;
  highlighted: boolean;
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

function timeAgo(iso: string, lang: Lang): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1)  return lang === 'ja' ? 'たった今' : 'just now';
  if (mins < 60) return lang === 'ja' ? `${mins}分前` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return lang === 'ja' ? `${hrs}時間前` : `${hrs}h ago`;
  return lang === 'ja' ? `${Math.floor(hrs / 24)}日前` : `${Math.floor(hrs / 24)}d ago`;
}

export default function QuestionRow({
  question, voterId, lang, highlighted, onBuildOn, onVoteChange,
}: Props) {
  const t = i18n[lang].board;
  const [contextOpen, setContextOpen] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  // Primary: viewer's language. Secondary: the other language.
  const primaryText = lang === 'ja'
    ? (question.content_ja ?? question.content)
    : (question.content_en ?? question.content);
  const secondaryText = lang === 'ja' ? question.content_en : question.content_ja;

  const primaryContext = lang === 'ja'
    ? (question.context_ja ?? question.context)
    : (question.context_en ?? question.context);
  const secondaryContext = lang === 'ja' ? question.context_en : question.context_ja;

  // Badge: is the primary line a translation of the original?
  // content always holds the immutable original — if primary differs, it's a translation.
  const primaryIsTranslation = primaryText !== question.content;

  const badgeLabel = primaryIsTranslation
    ? (lang === 'ja' ? '翻訳 / Translated' : 'Translated / 翻訳')
    : (lang === 'ja' ? '原文 / Original' : 'Original / 原文');

  const accent = question.category_id ? accentForId(question.category_id) : '#CBD5E1';

  async function handleVote() {
    if (voteLoading) return;
    setVoteLoading(true);
    try {
      const res = await fetch(`/api/questions/${question.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: voterId }),
      });
      if (res.ok) {
        const { voted } = await res.json();
        onVoteChange(question.id, voted);
      }
    } finally {
      setVoteLoading(false);
    }
  }

  return (
    <div
      id={`note-${question.id}`}
      className={`border-b border-slate-100 transition-colors duration-500 ${
        highlighted ? 'bg-indigo-50 ring-2 ring-inset ring-indigo-300' : 'hover:bg-slate-50/60'
      }`}
    >
      <div className="flex items-start gap-3 px-5 py-4">

        {/* Vote — compact vertical △/count */}
        <button
          onClick={handleVote}
          disabled={voteLoading}
          title={lang === 'ja' ? '投票' : 'Vote'}
          className={`flex flex-col items-center w-8 shrink-0 pt-0.5 gap-0.5 transition-colors disabled:opacity-50 ${
            question.voted_by_me
              ? 'text-indigo-600'
              : 'text-slate-300 hover:text-indigo-400'
          }`}
        >
          <span className="text-sm leading-none font-bold">
            {question.voted_by_me ? '▲' : '△'}
          </span>
          <span className="text-xs font-bold leading-tight">{question.vote_count}</span>
        </button>

        {/* Category badge */}
        <div className="shrink-0 pt-0.5 w-[90px]">
          <CategoryBadge category={question.category} lang={lang} />
        </div>

        {/* Bilingual content with left accent border */}
        <div
          className="flex-1 min-w-0 pl-4 flex flex-col gap-1.5"
          style={{ borderLeft: `2px solid ${accent}` }}
        >
          {/* Parent thread indicator */}
          {question.parent && (
            <p className="text-xs text-slate-400 line-clamp-1">
              <span className="mr-1">↳</span>
              <span className="italic">{question.parent.content}</span>
            </p>
          )}

          {/* Primary question in viewer's language */}
          <div className="flex gap-2 items-start">
            <span className="text-xs font-semibold text-slate-400 shrink-0 mt-0.5 w-4">Q.</span>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{primaryText}</p>
          </div>

          {/* Secondary question in the other language */}
          {secondaryText && (
            <div className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-slate-300 shrink-0 mt-0.5 w-4">Q.</span>
              <p className="text-sm text-slate-400 leading-snug">{secondaryText}</p>
            </div>
          )}
        </div>

        {/* Original / Translated badge */}
        <div className="shrink-0 pt-1">
          <span className={`inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border whitespace-nowrap ${
            primaryIsTranslation
              ? 'bg-orange-50 text-orange-600 border-orange-200'
              : 'bg-green-50 text-green-600 border-green-200'
          }`}>
            {badgeLabel}
          </span>
        </div>

        {/* Actions column */}
        <div className="shrink-0 flex flex-col items-end gap-1 text-xs text-slate-400 whitespace-nowrap pl-2 min-w-[130px]">
          <span className="text-slate-500 font-medium truncate max-w-[160px]">
            {question.author_name}
            <span className="mx-1 text-slate-300">·</span>
            {question.author_affiliation}
          </span>
          <div className="flex items-center gap-2">
            <span>{timeAgo(question.created_at, lang)}</span>
            {question.context && (
              <button
                onClick={() => setContextOpen(o => !o)}
                className="hover:text-indigo-600 transition-colors font-medium"
              >
                {lang === 'ja' ? '背景・理由' : 'Context'}
              </button>
            )}
          </div>
          <button
            onClick={() => onBuildOn(question)}
            className="text-indigo-500 hover:text-indigo-700 font-semibold transition-colors"
          >
            + {t.buildOn}
          </button>
        </div>
      </div>

      {/* Inline context expansion — shows both languages when available */}
      {question.context && contextOpen && (
        <div
          className="mx-5 mb-4 rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3 flex flex-col gap-2"
          style={{ borderLeft: '3px solid #F59E0B' }}
        >
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
            {t.context}
          </span>
          {primaryContext && (
            <div className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-slate-400 shrink-0 mt-0.5 w-4">Q.</span>
              <p className="text-xs text-slate-700 leading-relaxed">{primaryContext}</p>
            </div>
          )}
          {secondaryContext && secondaryContext !== primaryContext && (
            <div className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-slate-300 shrink-0 mt-0.5 w-4">Q.</span>
              <p className="text-xs text-slate-400 leading-relaxed">{secondaryContext}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
