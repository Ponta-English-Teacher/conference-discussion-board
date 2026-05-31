'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/useLanguage';
import type { Category, Question, Session } from '@/types';
import CategoryBadge from '@/components/board/CategoryBadge';

interface Props {
  sessionId: string;
}

export default function SessionDetail({ sessionId }: Props) {
  const { lang, toggle, t } = useLanguage();
  const tm = t.moderator;

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newLabelJa, setNewLabelJa] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);

  // Load this session by ID
  useEffect(() => {
    supabase
      .from('cdb_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => { if (data) setSession(data as Session); });
  }, [sessionId]);

  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/questions?session_id=${sessionId}`);
    if (res.ok) setQuestions(await res.json());
  }, [sessionId]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch(`/api/categories?session_id=${sessionId}`);
    if (res.ok) setCategories(await res.json());
  }, [sessionId]);

  useEffect(() => {
    Promise.all([fetchQuestions(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchQuestions, fetchCategories]);

  // Realtime — keep moderator view live
  useEffect(() => {
    const channel = supabase
      .channel(`moderator-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdb_questions' }, fetchQuestions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdb_categories' }, () => {
        fetchCategories();
        fetchQuestions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, fetchQuestions, fetchCategories]);

  async function assignCategory(questionId: string, categoryId: string | null) {
    await fetch(`/api/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: categoryId }),
    });
    setQuestions(prev =>
      prev.map(q =>
        q.id === questionId
          ? { ...q, category_id: categoryId, category: categories.find(c => c.id === categoryId) ?? null }
          : q
      )
    );
  }

  async function addCategory() {
    if (!newLabel.trim()) return;
    setAddingCategory(true);
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, label: newLabel.trim(), label_ja: newLabelJa.trim() || null }),
    });
    setNewLabel('');
    setNewLabelJa('');
    await fetchCategories();
    setAddingCategory(false);
  }

  function copyBoardLink() {
    navigator.clipboard.writeText(`${window.location.origin}/board/${sessionId}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const sessionTitle = session
    ? (lang === 'ja' && session.title_ja ? session.title_ja : session.title)
    : '';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/moderator"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            {tm.backToSessions}
          </Link>
          {session && <h1 className="font-semibold text-sm">{sessionTitle}</h1>}
        </div>
        <button
          onClick={toggle}
          className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
        >
          {lang === 'en' ? '日本語' : 'English'}
        </button>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full flex flex-col gap-6">

        {/* Board link to share */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <span className="text-xs text-gray-500 shrink-0">{tm.boardLink}</span>
          <span className="text-xs font-mono text-gray-600 flex-1 truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/board/${sessionId}` : `/board/${sessionId}`}
          </span>
          <button
            onClick={copyBoardLink}
            className="shrink-0 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
          >
            {copiedLink ? tm.linkCopied : tm.copyLink}
          </button>
        </section>

        {/* Add category */}
        <section className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-3">
          <h2 className="font-medium text-sm">{tm.newCategory}</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              placeholder={tm.categoryNameEn}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              value={newLabelJa}
              onChange={e => setNewLabelJa(e.target.value)}
              placeholder={tm.categoryNameJa}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <button
              onClick={addCategory}
              disabled={addingCategory || !newLabel.trim()}
              className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {tm.addCategory}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <span key={cat.id} className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600">
                {cat.label}{cat.label_ja ? ` / ${cat.label_ja}` : ''}
              </span>
            ))}
          </div>
        </section>

        {/* Question list */}
        <section className="flex flex-col gap-3">
          <h2 className="font-medium text-sm">{tm.allQuestions} ({questions.length})</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">{t.common.loading}</p>
          ) : questions.map(q => (
            <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-2">
              {/* Original content — displayed read-only; never editable */}
              <p className="text-sm text-gray-800">{q.content}</p>
              <p className="text-xs text-gray-400">
                {q.author_name} · {q.author_affiliation}
                <span className="ml-2">▲ {q.vote_count}</span>
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">{tm.assignCategory}:</span>
                <CategoryBadge category={q.category} lang={lang} />
                <select
                  value={q.category_id ?? ''}
                  onChange={e => assignCategory(q.id, e.target.value || null)}
                  className="text-xs border border-gray-300 rounded-md px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  <option value="">{tm.uncategorized}</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}{cat.label_ja ? ` / ${cat.label_ja}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
