'use client';

import type { Question, Lang } from '@/types';

interface Props {
  questions: Question[];
  lang: Lang;
  onSelect: (id: string) => void;
}

export default function LiveFeed({ questions, lang, onSelect }: Props) {
  const latest = [...questions]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="flex flex-col h-full border-l border-slate-200/80 bg-white/60">
      <div className="px-4 py-3 border-b border-slate-100 shrink-0">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
          {lang === 'ja' ? '最新の質問' : 'Live Feed'}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {latest.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-400 text-center">
            {lang === 'ja' ? 'まだ質問がありません' : 'No questions yet'}
          </p>
        ) : (
          latest.map(q => {
            const displayContent = lang === 'ja'
              ? (q.content_ja ?? q.content)
              : (q.content_en ?? q.content);
            return (
            <button
              key={q.id}
              onClick={() => onSelect(q.id)}
              className="w-full text-left px-4 py-3 hover:bg-indigo-50/60 transition-colors flex flex-col gap-1"
            >
              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-medium">
                {displayContent}
              </p>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="truncate flex-1">{q.author_name}</span>
                <span className="text-slate-300 shrink-0">·</span>
                <span className="text-indigo-500 font-semibold shrink-0">▲ {q.vote_count}</span>
              </div>
            </button>
            );
          })
        )}
      </div>
    </div>
  );
}
