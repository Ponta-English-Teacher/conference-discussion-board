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
  notifyEmail: string | null;
  notifyOnResponse: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function NewNoteForm({
  sessionId, authorName, authorAffiliation, parent, lang,
  notifyEmail, notifyOnResponse,
  onClose, onSubmitted,
}: Props) {
  const t = i18n[lang].board;
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [contextOpen, setContextOpen] = useState(false);
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
          // context is only sent when the field is open and non-empty
          context: contextOpen && context.trim() ? context.trim() : null,
          author_name: authorName,
          author_affiliation: authorAffiliation,
          parent_id: parent?.id ?? null,
          lang,
          author_email: notifyEmail,
          notify_on_response: notifyOnResponse,
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200/60 overflow-hidden">
        {/* Header strip */}
        <div className="bg-indigo-600 px-6 py-4">
          <h2 className="font-semibold text-white text-base">
            {parent ? `+ ${t.buildOn}` : t.newQuestion}
          </h2>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Parent reference — read-only, never editable */}
          {parent && (
            <div className="bg-amber-50 border border-amber-200/60 rounded-xl p-3.5 text-sm"
                 style={{ borderLeft: '3px solid #F59E0B' }}>
              <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide block mb-1.5">
                {t.buildingOn}
              </span>
              <p className="text-slate-600 line-clamp-3 leading-relaxed">{parent.content}</p>
              <p className="text-xs text-slate-400 mt-1.5">— {parent.author_name}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Main question — required */}
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={t.questionPlaceholder}
              rows={4}
              className="border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition leading-relaxed text-slate-700 placeholder:text-slate-400"
              autoFocus
            />

            {/* Context toggle button */}
            <button
              type="button"
              onClick={() => setContextOpen(o => !o)}
              className="self-start text-xs text-slate-500 hover:text-indigo-600 transition-colors font-medium flex items-center gap-1.5"
            >
              <span className="text-base leading-none">{contextOpen ? '−' : '+'}</span>
              {contextOpen ? t.hideContext : t.addContext}
            </button>

            {/* Context textarea — optional, revealed on toggle */}
            {contextOpen && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {t.contextLabel}
                </label>
                <textarea
                  value={context}
                  onChange={e => setContext(e.target.value)}
                  placeholder={t.contextPlaceholder}
                  rows={3}
                  className="border border-slate-200 bg-slate-50/80 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none transition leading-relaxed text-slate-600 placeholder:text-slate-400"
                />
              </div>
            )}

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium"
              >
                {t.cancel}
              </button>
              <button
                type="submit"
                disabled={loading || !content.trim()}
                className="px-5 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm disabled:opacity-50"
              >
                {loading ? i18n[lang].common.loading : t.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
