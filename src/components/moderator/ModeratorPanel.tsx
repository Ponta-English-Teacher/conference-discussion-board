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
  const [fetchError, setFetchError] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [titleJa, setTitleJa] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function fetchSessions() {
    const res = await fetch('/api/sessions');
    if (res.ok) {
      setSessions(await res.json());
      setFetchError('');
    } else {
      const body = await res.json().catch(() => ({}));
      setFetchError(body.error ?? `Failed to load sessions (${res.status})`);
    }
  }

  useEffect(() => {
    fetchSessions().finally(() => setLoading(false));
  }, []);

  async function handleCreateSession(e: React.FormEvent) {
    e.preventDefault();
    if (!titleEn.trim()) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleEn.trim(), title_ja: titleJa.trim() || null }),
      });
      if (res.ok) {
        setTitleEn('');
        setTitleJa('');
        await fetchSessions();
      } else {
        const body = await res.json().catch(() => ({}));
        setCreateError(body.error ?? `Server error (${res.status})`);
      }
    } catch (err) {
      setCreateError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreating(false);
    }
  }

  function boardUrl(sessionId: string) {
    return `${window.location.origin}/board/${sessionId}`;
  }

  function copyLink(sessionId: string) {
    navigator.clipboard.writeText(boardUrl(sessionId));
    setCopiedId(sessionId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleActive(session: Session) {
    setTogglingId(session.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !session.is_active }),
      });
      if (res.ok) {
        setSessions(prev => prev.map(s => s.id === session.id ? { ...s, is_active: !s.is_active } : s));
      }
    } finally {
      setTogglingId(null);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F9FF' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="font-bold text-slate-800">{tm.title}</h1>
        </div>
        <button
          onClick={toggle}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors"
        >
          {lang === 'en' ? '日本語' : 'English'}
        </button>
      </header>

      <main className="flex-1 p-5 max-w-3xl mx-auto w-full flex flex-col gap-6">

        {/* Create new session */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
            <h2 className="font-semibold text-sm text-slate-700">{tm.newSession}</h2>
          </div>
          <div className="p-5">
            <form onSubmit={handleCreateSession} className="flex flex-col gap-3">
              <input
                type="text"
                value={titleEn}
                onChange={e => setTitleEn(e.target.value)}
                placeholder={tm.sessionTitleEn}
                className="border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
              <input
                type="text"
                value={titleJa}
                onChange={e => setTitleJa(e.target.value)}
                placeholder={tm.sessionTitleJa}
                className="border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              />
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={creating || !titleEn.trim()}
                  className="bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm disabled:opacity-50"
                >
                  {creating ? t.common.loading : tm.createSession}
                </button>
                {createError && <p className="text-red-500 text-sm">{createError}</p>}
              </div>
            </form>
          </div>
        </section>

        {/* Session list */}
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold text-sm text-slate-600 px-1">{tm.sessions}</h2>
          {loading ? (
            <p className="text-slate-400 text-sm px-1">{t.common.loading}</p>
          ) : fetchError ? (
            <p className="text-red-500 text-sm px-1">{fetchError}</p>
          ) : sessions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center text-slate-400 text-sm">
              {tm.noSessions}
            </div>
          ) : (
            sessions.map(s => {
              const displayTitle = lang === 'ja' && s.title_ja ? s.title_ja : s.title;
              return (
                <div key={s.id} className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
                  <div className="px-5 py-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-slate-800 truncate">{displayTitle}</p>
                        <button
                          onClick={() => toggleActive(s)}
                          disabled={togglingId === s.id}
                          className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors disabled:opacity-50 ${
                            s.is_active
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {s.is_active
                            ? (lang === 'ja' ? '● 進行中' : '● Active')
                            : (lang === 'ja' ? '○ 終了' : '○ Inactive')}
                        </button>
                      </div>
                      {s.title_ja && lang === 'en' && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{s.title_ja}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">
                        {formatDate(s.created_at)}
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span className="font-medium text-slate-500">{s.question_count ?? 0}</span> {tm.questions}
                      </p>
                    </div>
                    <Link
                      href={`/moderator/${s.id}`}
                      className="shrink-0 text-sm text-indigo-600 border border-indigo-200 rounded-xl px-3.5 py-1.5 hover:bg-indigo-50 transition-colors font-medium"
                    >
                      {tm.manageSession}
                    </Link>
                  </div>

                  {/* Share link strip */}
                  <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-50/80 border-t border-slate-100">
                    <span className="text-xs text-slate-400 shrink-0">{tm.boardLink}</span>
                    <span className="text-xs text-slate-500 truncate flex-1 font-mono">
                      /board/{s.id}
                    </span>
                    <button
                      onClick={() => copyLink(s.id)}
                      className={`shrink-0 text-xs border rounded-lg px-2.5 py-1 transition-colors ${
                        copiedId === s.id
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
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
