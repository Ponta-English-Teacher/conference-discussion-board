'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/useLanguage';
import type { Session } from '@/types';

export default function ModeratorPanel() {
  const { lang, toggle, t } = useLanguage();
  const tm = t.moderator;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [titleEn, setTitleEn] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function fetchSessions() {
    const res = await fetch('/api/sessions');
    if (res.ok) setSessions(await res.json());
  }

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false));
  }, []);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!titleEn.trim()) return;
    setCreating(true);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titleEn.trim(), title_ja: titleJa.trim() || null }),
    });
    if (res.ok) {
      setTitleEn('');
      setTitleJa('');
      await fetchSessions();
    }
    setCreating(false);
  }

  function boardUrl(sessionId: string) {
    return `${window.location.origin}/board/${sessionId}`;
  }

  function copyLink(sessionId: string) {
    navigator.clipboard.writeText(boardUrl(sessionId));
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-semibold">{tm.title}</h1>
        <button
          onClick={toggle}
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
        >
          {lang === 'en' ? '日本語' : 'English'}
        </button>
      </header>

      <main className="flex-1 p-4 max-w-3xl mx-auto w-full flex flex-col gap-6">

        {/* Create new session */}
        <section className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col gap-4">
          <h2 className="font-medium text-sm">{tm.newSession}</h2>
          <form onSubmit={handleCreateSession} className="flex flex-col gap-3">
            <input
              type="text"
              value={titleEn}
              onChange={e => setTitleEn(e.target.value)}
              placeholder={tm.sessionTitleEn}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              value={titleJa}
              onChange={e => setTitleJa(e.target.value)}
              placeholder={tm.sessionTitleJa}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              type="submit"
              disabled={creating || !titleEn.trim()}
              className="self-start bg-gray-900 text-white text-sm px-5 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {creating ? t.common.loading : tm.createSession}
            </button>
          </form>
        </section>

        {/* Session list */}
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-sm">{tm.sessions}</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">{t.common.loading}</p>
          ) : sessions.length === 0 ? (
            <p className="text-gray-400 text-sm">{tm.noSessions}</p>
          ) : (
            sessions.map(s => {
              const displayTitle = lang === 'ja' && s.title_ja ? s.title_ja : s.title;
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{displayTitle}</p>
                      {s.title_ja && lang === 'en' && (
                        <p className="text-xs text-gray-400">{s.title_ja}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatDate(s.created_at)} · {s.question_count ?? 0} {tm.questions}
                      </p>
                    </div>
                    <Link
                      href={`/moderator/${s.id}`}
                      className="shrink-0 text-sm text-gray-600 border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                    >
                      {tm.manageSession}
                    </Link>
                  </div>

                  {/* Share link */}
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400 shrink-0">{tm.boardLink}</span>
                    <span className="text-xs text-gray-600 truncate flex-1 font-mono">
                      /board/{s.id}
                    </span>
                    <button
                      onClick={() => copyLink(s.id)}
                      className="shrink-0 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-2 py-1 transition-colors"
                    >
                      {copiedId === s.id ? tm.linkCopied : tm.copyLink}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
