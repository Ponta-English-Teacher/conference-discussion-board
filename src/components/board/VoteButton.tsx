'use client';

import { useState } from 'react';
import type { Lang } from '@/types';

interface Props {
  questionId: string;
  voteCount: number;
  votedByMe: boolean;
  voterId: string;
  lang: Lang;
  onVoteChange: (questionId: string, voted: boolean) => void;
}

export default function VoteButton({ questionId, voteCount, votedByMe, voterId, lang, onVoteChange }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleVote() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/questions/${questionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voter_id: voterId }),
      });
      if (res.ok) {
        const { voted } = await res.json();
        onVoteChange(questionId, voted);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleVote}
      disabled={loading}
      title={lang === 'ja' ? '投票' : 'Vote'}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition-all ${
        votedByMe
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
          : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
      } disabled:opacity-50`}
    >
      <span className="text-base leading-none">{votedByMe ? '▲' : '△'}</span>
      <span>{voteCount}</span>
    </button>
  );
}
