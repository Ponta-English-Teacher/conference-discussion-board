'use client';

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

export default function StickyNote({ question, voterId, lang, onBuildOn, onVoteChange }: Props) {
  const t = i18n[lang].board;

  return (
    <div className="break-inside-avoid mb-4 bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
      {/* Category badge — top left */}
      <CategoryBadge category={question.category} lang={lang} />

      {/* Parent reference — shown if this is a "build on" note */}
      {question.parent && (
        <div className="text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5 italic line-clamp-2">
          {t.buildingOn} {question.parent.content}
        </div>
      )}

      {/* Question content — immutable original wording */}
      <p className="text-sm text-gray-800 leading-relaxed">{question.content}</p>

      {/* Author */}
      <p className="text-xs text-gray-400">
        {question.author_name} · {question.author_affiliation}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <VoteButton
          questionId={question.id}
          voteCount={question.vote_count}
          votedByMe={question.voted_by_me ?? false}
          voterId={voterId}
          lang={lang}
          onVoteChange={onVoteChange}
        />
        <button
          onClick={() => onBuildOn(question)}
          className="text-xs text-gray-500 hover:text-gray-800 underline underline-offset-2 transition-colors"
        >
          {t.buildOn}
        </button>
      </div>
    </div>
  );
}
