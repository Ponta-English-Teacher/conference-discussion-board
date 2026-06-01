'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/lib/supabase/client';
import { useLanguage } from '@/lib/useLanguage';
import type { Category, Question, Session } from '@/types';
import CategoryBadge from '@/components/board/CategoryBadge';

interface Props {
  sessionId: string;
}

// Accent colors keyed by index — must stay in sync with CategoryBadge palette
const ACCENT_COLORS = [
  '#6366F1', '#14B8A6', '#8B5CF6', '#F59E0B',
  '#F43F5E', '#10B981', '#0EA5E9', '#F97316',
];
function accentForIndex(i: number) { return ACCENT_COLORS[i % ACCENT_COLORS.length]; }

export default function SessionDetail({ sessionId }: Props) {
  const { lang, toggle, t } = useLanguage();
  const tm = t.moderator;

  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // UI state
  const [newLabel, setNewLabel] = useState('');
  const [newLabelJa, setNewLabelJa] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [confirmDeleteCategoryId, setConfirmDeleteCategoryId] = useState<string | null>(null);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(new Set());
  const [expandedContextIds, setExpandedContextIds] = useState<Set<string>>(new Set());

  // AI Organize state
  const [organizing, setOrganizing] = useState(false);
  const [organizeError, setOrganizeError] = useState('');
  const [confirmOrganize, setConfirmOrganize] = useState(false);

  // QR code state
  const [showQr, setShowQr] = useState(false);

  // Reset Questions state
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  function toggleCategoryExpand(id: string) {
    setExpandedCategoryIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleContext(questionId: string) {
    setExpandedContextIds(prev => {
      const next = new Set(prev);
      next.has(questionId) ? next.delete(questionId) : next.add(questionId);
      return next;
    });
  }

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data) setSession(data as Session); });
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

  async function handleDeleteCategory(categoryId: string) {
    setConfirmDeleteCategoryId(null);
    const res = await fetch(`/api/categories/${categoryId}`, { method: 'DELETE' });
    if (res.ok) {
      await Promise.all([fetchCategories(), fetchQuestions()]);
    }
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

  async function handleOrganize() {
    setConfirmOrganize(false);
    setOrganizing(true);
    setOrganizeError('');
    try {
      const res = await fetch(`/api/sessions/${sessionId}/organize`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setOrganizeError(body.error ?? `Error ${res.status}`);
      } else {
        await Promise.all([fetchCategories(), fetchQuestions()]);
        // Expand all categories after organize so the moderator sees the result
        setExpandedCategoryIds(new Set(categories.map(c => c.id)));
      }
    } catch {
      setOrganizeError('Network error — please try again.');
    } finally {
      setOrganizing(false);
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    setResetting(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reset`, { method: 'POST' });
      if (res.ok) {
        await Promise.all([fetchCategories(), fetchQuestions()]);
      }
    } finally {
      setResetting(false);
    }
  }

  function copyBoardLink() {
    navigator.clipboard.writeText(`${window.location.origin}/board/${sessionId}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const sessionTitle = session
    ? (lang === 'ja' && session.title_ja ? session.title_ja : session.title)
    : '';

  // Build theme groups
  const catMap = new Map(categories.map(c => [c.id, c]));
  const grouped = new Map<string | null, Question[]>();
  for (const q of questions) {
    const key = q.category_id ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(q);
  }

  const uncategorized = grouped.get(null) ?? [];

  function categoryVoteTotal(qs: Question[]) {
    return qs.reduce((sum, q) => sum + q.vote_count, 0);
  }

  function catLabel(cat: Category) {
    return lang === 'ja' && cat.label_ja ? cat.label_ja : cat.label;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F8F9FF' }}>
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-5 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/moderator"
            className="text-sm text-slate-400 hover:text-indigo-600 transition-colors shrink-0 font-medium"
          >
            {tm.backToSessions}
          </Link>
          {session && (
            <>
              <span className="text-slate-200">/</span>
              <h1 className="font-bold text-slate-800 text-sm truncate">{sessionTitle}</h1>
            </>
          )}
        </div>
        <button
          onClick={toggle}
          className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors shrink-0"
        >
          {lang === 'en' ? '日本語' : 'English'}
        </button>
      </header>

      <main className="flex-1 p-5 max-w-4xl mx-auto w-full flex flex-col gap-5">

        {/* Board link */}
        <div className="bg-indigo-50 border border-indigo-200/60 rounded-2xl px-5 py-3.5 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
          </div>
          <span className="text-xs text-indigo-600 font-medium shrink-0">{tm.boardLink}</span>
          <span className="text-xs font-mono text-indigo-700 flex-1 truncate">
            {typeof window !== 'undefined' ? `${window.location.origin}/board/${sessionId}` : `/board/${sessionId}`}
          </span>
          <button
            onClick={copyBoardLink}
            className={`shrink-0 text-xs border rounded-lg px-3 py-1.5 transition-colors font-medium ${
              copiedLink
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white'
            }`}
          >
            {copiedLink ? tm.linkCopied : tm.copyLink}
          </button>
          <button
            onClick={() => setShowQr(o => !o)}
            className={`shrink-0 text-xs border rounded-lg px-3 py-1.5 transition-colors font-medium ${
              showQr
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
            }`}
          >
            QR
          </button>
        </div>

        {/* QR code panel */}
        {showQr && (
          <div className="mt-3 flex flex-col items-center gap-3 bg-white rounded-2xl border border-slate-200/60 p-6">
            <QRCodeSVG
              value={typeof window !== 'undefined' ? `${window.location.origin}/board/${sessionId}` : `/board/${sessionId}`}
              size={180}
              bgColor="#ffffff"
              fgColor="#1e1b4b"
            />
            <p className="text-xs text-slate-500 text-center">
              {lang === 'ja'
                ? 'QRコードをスキャンして参加'
                : 'Scan to join the participant board'}
            </p>
          </div>
        )}

        {/* AI Organize + Add Category */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* AI Organize */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
              </svg>
              <h2 className="font-semibold text-sm text-slate-700">
                {lang === 'ja' ? 'AIによるテーマ整理' : 'AI Organize'}
              </h2>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                {lang === 'ja'
                  ? 'すべての質問を分析し、テーマに分類します。既存カテゴリーは可能な限り再利用されます。'
                  : 'Analyzes all questions together, groups them into themes, and reassigns every question. Existing categories are reused where appropriate.'}
              </p>
              {organizeError && (
                <p className="text-xs text-red-500">{organizeError}</p>
              )}
              <button
                onClick={() => setConfirmOrganize(true)}
                disabled={organizing || questions.length === 0}
                className="self-start bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {organizing ? (
                  <>
                    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {lang === 'ja' ? '分析中…' : 'Organizing…'}
                  </>
                ) : (
                  lang === 'ja' ? 'テーマを整理する' : 'Organize Themes'
                )}
              </button>
            </div>
          </section>

          {/* Add category manually */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
              <h2 className="font-semibold text-sm text-slate-700">{tm.newCategory}</h2>
            </div>
            <div className="p-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  placeholder={tm.categoryNameEn}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
                <input
                  type="text"
                  value={newLabelJa}
                  onChange={e => setNewLabelJa(e.target.value)}
                  placeholder={tm.categoryNameJa}
                  className="border border-slate-300 rounded-xl px-3 py-2 text-sm flex-1 min-w-[140px] focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                />
                <button
                  onClick={addCategory}
                  disabled={addingCategory || !newLabel.trim()}
                  className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm disabled:opacity-50"
                >
                  {tm.addCategory}
                </button>
              </div>
              {/* Existing category pills */}
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <span key={cat.id} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                      {cat.label}{cat.label_ja ? ` / ${cat.label_ja}` : ''}
                      <button
                        onClick={() => setConfirmDeleteCategoryId(cat.id)}
                        className="ml-0.5 text-slate-400 hover:text-red-500 transition-colors leading-none font-bold"
                        aria-label={tm.deleteCategory}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Theme-first question view */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-sm text-slate-600">
              {lang === 'ja' ? 'テーマ別一覧' : 'Themes'}{' '}
              <span className="font-normal text-slate-400">({questions.length})</span>
            </h2>
            <button
              onClick={() => setConfirmReset(true)}
              disabled={resetting || questions.length === 0}
              className="text-xs text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              {resetting
                ? (lang === 'ja' ? '削除中…' : 'Resetting…')
                : (lang === 'ja' ? '質問をリセット' : 'Reset Questions')}
            </button>
          </div>

          {loading ? (
            <p className="text-slate-400 text-sm px-1">{t.common.loading}</p>
          ) : (
            <>
              {/* Categorized themes */}
              {categories.map((cat, idx) => {
                const qs = grouped.get(cat.id) ?? [];
                const accent = accentForIndex(idx);
                const isExpanded = expandedCategoryIds.has(cat.id);
                const repQuestion = qs.find(q => q.id === cat.representative_question_id);
                const triggerQuestion = qs.find(q => q.id === cat.discussion_trigger_question_id);

                return (
                  <div
                    key={cat.id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden"
                    style={{ borderLeft: `4px solid ${accent}` }}
                  >
                    {/* Theme header — div instead of button to avoid nested-button invalid HTML */}
                    <div
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer select-none"
                      onClick={() => toggleCategoryExpand(cat.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryBadge category={cat} lang={lang} />
                        <span className="text-xs text-slate-400">
                          {qs.length} {lang === 'ja' ? '件' : qs.length === 1 ? 'question' : 'questions'}
                        </span>
                        <span className="text-xs font-semibold text-indigo-600">▲ {categoryVoteTotal(qs)}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setConfirmDeleteCategoryId(cat.id); }}
                          className="text-xs text-slate-300 hover:text-red-400 transition-colors px-1"
                          aria-label={tm.deleteCategory}
                        >
                          ×
                        </button>
                        <span className="text-slate-300 text-sm">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* Representative + trigger previews */}
                    {(repQuestion || triggerQuestion) && !isExpanded && (
                      <div className="px-5 pb-4 flex flex-col gap-2">
                        {repQuestion && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs shrink-0 font-semibold text-amber-600 w-5 text-center mt-0.5">★</span>
                            <BilingualText
                              primary={lang === 'en' ? (repQuestion.content_en ?? repQuestion.content) : (repQuestion.content_ja ?? repQuestion.content)}
                              secondary={lang === 'en' ? repQuestion.content_ja : repQuestion.content_en}
                              secondaryLang={lang === 'en' ? 'JA' : 'EN'}
                              primaryClassName="text-xs text-slate-600 leading-snug"
                              secondaryClassName="text-xs text-slate-400 leading-snug"
                              lineClamp
                            />
                          </div>
                        )}
                        {triggerQuestion && triggerQuestion.id !== repQuestion?.id && (
                          <div className="flex items-start gap-2">
                            <span className="text-xs shrink-0 font-semibold text-indigo-500 w-5 text-center mt-0.5">⚡</span>
                            <BilingualText
                              primary={lang === 'en' ? (triggerQuestion.content_en ?? triggerQuestion.content) : (triggerQuestion.content_ja ?? triggerQuestion.content)}
                              secondary={lang === 'en' ? triggerQuestion.content_ja : triggerQuestion.content_en}
                              secondaryLang={lang === 'en' ? 'JA' : 'EN'}
                              primaryClassName="text-xs text-slate-600 leading-snug"
                              secondaryClassName="text-xs text-slate-400 leading-snug"
                              lineClamp
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expanded question list */}
                    {isExpanded && (
                      <div className="border-t border-slate-100 divide-y divide-slate-50">
                        {qs.length === 0 ? (
                          <p className="px-5 py-4 text-xs text-slate-400 italic">
                            {lang === 'ja' ? 'このカテゴリーに質問はありません' : 'No questions in this category'}
                          </p>
                        ) : (
                          qs.map(q => (
                            <QuestionItem
                              key={q.id}
                              question={q}
                              categories={categories}
                              lang={lang}
                              tm={tm}
                              t={t}
                              isRepresentative={q.id === cat.representative_question_id}
                              isTrigger={q.id === cat.discussion_trigger_question_id}
                              contextOpen={expandedContextIds.has(q.id)}
                              onToggleContext={() => toggleContext(q.id)}
                              onAssign={assignCategory}
                            />
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Uncategorized */}
              {uncategorized.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden border-l-4 border-l-slate-300">
                  <button
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 transition-colors text-left"
                    onClick={() => toggleCategoryExpand('__uncategorized__')}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200 font-medium">
                        {tm.uncategorized}
                      </span>
                      <span className="text-xs text-slate-400">
                        {uncategorized.length} {lang === 'ja' ? '件' : uncategorized.length === 1 ? 'question' : 'questions'}
                      </span>
                      <span className="text-xs font-semibold text-indigo-600">▲ {categoryVoteTotal(uncategorized)}</span>
                    </div>
                    <span className="text-slate-300 text-sm">
                      {expandedCategoryIds.has('__uncategorized__') ? '▲' : '▼'}
                    </span>
                  </button>

                  {expandedCategoryIds.has('__uncategorized__') && (
                    <div className="border-t border-slate-100 divide-y divide-slate-50">
                      {uncategorized.map(q => (
                        <QuestionItem
                          key={q.id}
                          question={q}
                          categories={categories}
                          lang={lang}
                          tm={tm}
                          t={t}
                          isRepresentative={false}
                          isTrigger={false}
                          contextOpen={expandedContextIds.has(q.id)}
                          onToggleContext={() => toggleContext(q.id)}
                          onAssign={assignCategory}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {questions.length === 0 && (
                <div className="bg-white rounded-2xl border border-slate-200/60 p-8 text-center text-slate-400 text-sm">
                  {lang === 'ja' ? 'まだ質問がありません' : 'No questions yet'}
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {/* Delete category confirmation */}
      {confirmDeleteCategoryId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200/60 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">{tm.confirmDeleteTitle}</h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">{tm.confirmDeleteBody}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDeleteCategoryId(null)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium">
                {tm.cancelDelete}
              </button>
              <button onClick={() => handleDeleteCategory(confirmDeleteCategoryId)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-semibold shadow-sm">
                {tm.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Questions confirmation */}
      {confirmReset && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200/60 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                {lang === 'ja' ? 'すべての質問を削除しますか？' : 'Delete all questions?'}
              </h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {lang === 'ja'
                ? 'すべての質問と投票が削除されます。セッションとカテゴリーは保持されます。この操作は元に戻せません。'
                : 'All questions and votes will be permanently deleted. The session and categories will be kept. This cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmReset(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium">
                {tm.cancelDelete}
              </button>
              <button onClick={handleReset} className="px-4 py-2 text-sm bg-red-600 text-white rounded-xl hover:bg-red-500 transition-colors font-semibold shadow-sm">
                {lang === 'ja' ? '削除する' : 'Delete all questions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Organize confirmation */}
      {confirmOrganize && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-slate-200/60 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
              </div>
              <h3 className="font-semibold text-slate-800 text-sm">
                {lang === 'ja' ? 'AIでテーマを整理しますか？' : 'Organize themes with AI?'}
              </h3>
            </div>
            <p className="text-sm text-slate-500 leading-relaxed">
              {lang === 'ja'
                ? '既存カテゴリーは可能な限り再利用されます。すべての質問はテーマに再割り当てされます。カテゴリー自体は削除されません。'
                : 'Existing categories will be reused where appropriate. All questions will be reassigned to themes. No categories will be deleted.'}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmOrganize(false)} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors font-medium">
                {tm.cancelDelete}
              </button>
              <button onClick={handleOrganize} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm">
                {lang === 'ja' ? '整理する' : 'Organize'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Compact bilingual text: primary line + muted secondary line ─────────────
function BilingualText({
  primary,
  secondary,
  secondaryLang,
  primaryClassName = 'text-sm text-slate-800 font-medium leading-snug',
  secondaryClassName = 'text-xs text-slate-400 leading-snug',
  lineClamp = false,
}: {
  primary: string | null | undefined;
  secondary: string | null | undefined;
  secondaryLang: 'EN' | 'JA';
  primaryClassName?: string;
  secondaryClassName?: string;
  lineClamp?: boolean;
}) {
  if (!primary) return null;
  const pCls = lineClamp ? `${primaryClassName} line-clamp-1` : primaryClassName;
  const sCls = lineClamp ? `${secondaryClassName} line-clamp-1` : secondaryClassName;
  return (
    <div className="flex flex-col gap-0.5">
      <p className={pCls}>{primary}</p>
      {secondary && (
        <p className={sCls}>
          <span className="font-bold text-[10px] tracking-wide mr-1 text-slate-300">{secondaryLang}</span>
          {secondary}
        </p>
      )}
    </div>
  );
}

// ── Inline sub-component for a single question row inside a theme ──────────
interface QuestionItemProps {
  question: Question;
  categories: Category[];
  lang: 'en' | 'ja';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tm: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  t: any;
  isRepresentative: boolean;
  isTrigger: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
  onAssign: (questionId: string, categoryId: string | null) => void;
}

function QuestionItem({
  question, categories, lang, tm, t,
  isRepresentative, isTrigger,
  contextOpen, onToggleContext, onAssign,
}: QuestionItemProps) {
  const displayContent = lang === 'ja'
    ? (question.content_ja ?? question.content)
    : (question.content_en ?? question.content);

  const displayContext = lang === 'ja'
    ? (question.context_ja ?? question.context)
    : (question.context_en ?? question.context);

  return (
    <div className="px-5 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-2">
        {/* Role badge */}
        {isRepresentative && (
          <span className="shrink-0 text-xs font-bold text-amber-600 w-5 text-center mt-0.5" title={lang === 'ja' ? '代表質問' : 'Representative'}>★</span>
        )}
        {isTrigger && !isRepresentative && (
          <span className="shrink-0 text-xs font-bold text-indigo-500 w-5 text-center mt-0.5" title={lang === 'ja' ? 'ディスカッション起点' : 'Discussion trigger'}>⚡</span>
        )}
        {!isRepresentative && !isTrigger && <span className="w-5 shrink-0" />}

        <div className="flex-1 min-w-0">
          <BilingualText
              primary={displayContent}
              secondary={lang === 'en' ? question.content_ja : question.content_en}
              secondaryLang={lang === 'en' ? 'JA' : 'EN'}
            />
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-slate-400">{question.author_name} · {question.author_affiliation}</span>
            <span className="text-xs font-semibold text-indigo-600">▲ {question.vote_count}</span>
            {displayContext && (
              <button
                onClick={onToggleContext}
                className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2 py-0.5 hover:bg-amber-100 transition-colors font-medium"
              >
                {contextOpen ? `− ${t.board.context}` : `+ ${tm.hasContext}`}
              </button>
            )}
          </div>
        </div>

        {/* Category assignment */}
        <select
          value={question.category_id ?? ''}
          onChange={e => onAssign(question.id, e.target.value || null)}
          className="shrink-0 text-xs border border-slate-300 rounded-lg px-2 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent bg-white transition"
        >
          <option value="">{tm.uncategorized}</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.label}{cat.label_ja ? ` / ${cat.label_ja}` : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Context in viewer's language */}
      {displayContext && contextOpen && (
        <div className="ml-7 bg-amber-50/60 rounded-xl border border-amber-100 px-4 py-2.5" style={{ borderLeft: '3px solid #F59E0B' }}>
          <span className="text-xs font-semibold text-amber-600 uppercase tracking-wide block mb-1">{t.board.context}</span>
          <BilingualText
            primary={displayContext}
            secondary={lang === 'en' ? question.context_ja : question.context_en}
            secondaryLang={lang === 'en' ? 'JA' : 'EN'}
            primaryClassName="text-xs text-slate-600 leading-relaxed"
            secondaryClassName="text-xs text-slate-400 leading-relaxed"
          />
        </div>
      )}
    </div>
  );
}
