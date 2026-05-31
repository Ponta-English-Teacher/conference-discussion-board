'use client';

import { useState } from 'react';
import type { Lang, Question } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  sessionId: string;
  authorName: string;
  authorAffiliation: string;
  parent: Pick<Question, 'id' | 'content' | 'author_name'> | null;
  lang: Lang;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function NewNoteForm({
  sessionId,
  authorName,
  authorAffiliation,
  parent,
  lang,
  onClose,
  onSubmitted,
}: Props) {
  const t = i18n[lang].board;
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          content: content.trim(),
          author_name: authorName,
          author_affiliation: authorAffiliation,
          parent_id: parent?.id ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      onSubmitted();
      onClose();
    } catch {
      setError(i18n[lang].common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-lg">{t.newQuestion}</h2>

        {parent && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600">
            <span className="font-medium text-gray-400 text-xs uppercase tracking-wide block mb-1">
              {t.buildingOn}
            </span>
            {/* Original parent text shown read-only for context — never editable */}
            <p className="line-clamp-3">{parent.content}</p>
            <p className="text-xs text-gray-400 mt-1">— {parent.author_name}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={t.questionPlaceholder}
            rows={4}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loading ? i18n[lang].common.loading : t.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
