'use client';

import type { Question, Lang } from '@/types';
import StickyNote from './StickyNote';
import { i18n } from '@/lib/i18n';

interface Props {
  questions: Question[];
  voterId: string;
  lang: Lang;
  onBuildOn: (question: Question) => void;
  onVoteChange: (questionId: string, voted: boolean) => void;
}

export default function NoteGrid({ questions, voterId, lang, onBuildOn, onVoteChange }: Props) {
  const t = i18n[lang].board;

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        {t.noQuestions}
      </div>
    );
  }

  return (
    // CSS masonry via columns — no extra library needed
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4">
      {questions.map(q => (
        <StickyNote
          key={q.id}
          question={q}
          voterId={voterId}
          lang={lang}
          onBuildOn={onBuildOn}
          onVoteChange={onVoteChange}
        />
      ))}
    </div>
  );
}
