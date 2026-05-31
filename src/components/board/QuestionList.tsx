'use client';

import type { Question, Lang } from '@/types';
import QuestionRow from './QuestionRow';
import { i18n } from '@/lib/i18n';

interface Props {
  questions: Question[];
  voterId: string;
  lang: Lang;
  highlightId: string | null;
  onBuildOn: (question: Question) => void;
  onVoteChange: (questionId: string, voted: boolean) => void;
}

export default function QuestionList({
  questions, voterId, lang, highlightId, onBuildOn, onVoteChange,
}: Props) {
  const t = i18n[lang].board;

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <p className="text-sm">{t.noQuestions}</p>
      </div>
    );
  }

  return (
    <div>
      {questions.map(q => (
        <QuestionRow
          key={q.id}
          question={q}
          voterId={voterId}
          lang={lang}
          highlighted={highlightId === q.id}
          onBuildOn={onBuildOn}
          onVoteChange={onVoteChange}
        />
      ))}
    </div>
  );
}
