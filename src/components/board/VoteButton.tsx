'use client';

import { useState } from 'react';
import type { Lang } from '@/types';
import { i18n } from '@/lib/i18n';

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
  const t = i18n[lang].board;

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
      className={`flex items-center gap-1.5 text-sm rounded-full px-3 py-1 border transition-colors ${
        votedByMe
          ? 'bg-gray-800 text-white border-gray-800'
          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
      } disabled:opacity-50`}
    >
      <span>{votedByMe ? '▲' : '△'}</span>
      <span>{voteCount}</span>
      <span className="sr-only">{t.votes}</span>
    </button>
  );
}
