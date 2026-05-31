'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getParticipant } from '@/lib/participant';
import { useLanguage } from '@/lib/useLanguage';
import type { Category, Question, Session, Participant } from '@/types';
import EntryForm from '@/components/landing/EntryForm';
import QuestionList from '@/components/board/QuestionList';
import CategoryFilter from '@/components/board/CategoryFilter';
import NewNoteForm from '@/components/board/NewNoteForm';
import LiveFeed from '@/components/board/LiveFeed';

interface Props {
  sessionId: string;
}

export default function BoardPage({ sessionId }: Props) {
  const { lang, toggle, t } = useLanguage();

  const [participant, setParticipant] = useState<Participant | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [buildOnQuestion, setBuildOnQuestion] = useState<Question | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionNotFound, setSessionNotFound] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check sessionStorage for an existing participant for this specific session
  useEffect(() => {
    setParticipant(getParticipant(sessionId));
  }, [sessionId]);

  // Load this session by ID — goes through the API route (service role key)
  // so the anon Supabase client's permissions don't affect the result.
  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setSession(data as Session);
        else setSessionNotFound(true);
      });
  }, [sessionId]);

  const fetchQuestions = useCallback(async () => {
    if (!participant) return;
    const res = await fetch(
      `/api/questions?session_id=${sessionId}&voter_id=${participant.id}`
    );
    if (res.ok) setQuestions(await res.json());
  }, [sessionId, participant]);

  const fetchCategories = useCallback(async () => {
    const res = await fetch(`/api/categories?session_id=${sessionId}`);
    if (res.ok) setCategories(await res.json());
  }, [sessionId]);

  // Initial data load (only once participant is known)
  useEffect(() => {
    if (!participant) return;
    Promise.all([fetchQuestions(), fetchCategories()]).finally(() =>
      setLoading(false)
    );
  }, [participant, fetchQuestions, fetchCategories]);

  // Supabase Realtime subscriptions
  useEffect(() => {
    if (!participant) return;
    const channel = supabase
      .channel(`board-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdb_questions' }, fetchQuestions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdb_votes' }, fetchQuestions)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cdb_categories' }, () => {
        fetchCategories();
        fetchQuestions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [sessionId, participant, fetchQuestions, fetchCategories]);

  // Optimistic vote toggle
  function handleVoteChange(questionId: string, voted: boolean) {
    setQuestions(prev =>
      prev
        .map(q =>
          q.id === questionId
            ? { ...q, voted_by_me: voted, vote_count: q.vote_count + (voted ? 1 : -1) }
            : q
        )
        .sort((a, b) =>
          b.vote_count - a.vote_count ||
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
    );
  }

  function handleBuildOn(question: Question) {
    setBuildOnQuestion(question);
    setShowNewForm(true);
  }

  function handleFeedSelect(questionId: string) {
    document.getElementById(`note-${questionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    setHighlightId(questionId);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 1500);
  }

  const filteredQuestions = questions.filter(q => {
    if (categoryFilter === null) return true;
    if (categoryFilter === 'uncategorized') return q.category_id === null;
    return q.category_id === categoryFilter;
  });

  const sessionTitle = session
    ? (lang === 'ja' && session.title_ja ? session.title_ja : session.title)
    : '';

  // Session not found in database
  if (sessionNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-3">
        <p className="text-gray-600 font-medium">Session not found.</p>
        <p className="text-gray-400 text-sm">This session link may be invalid or expired.</p>
        <p className="text-gray-400 text-xs mt-2">このセッションリンクは無効または期限切れの可能性があります。</p>
      </div>
    );
  }

  // No participant yet — show entry form
  if (!participant) {
    return (
      <EntryForm
        sessionId={sessionId}
        sessionTitle={sessionTitle}
        onEntered={p => {
          setParticipant(p);
          setLoading(true);
        }}
      />
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-slate-800 text-base leading-tight">{sessionTitle}</h1>
            <p className="text-xs text-slate-400 leading-tight">{participant.name} · {participant.affiliation}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-colors"
          >
            {lang === 'en' ? '日本語' : 'English'}
          </button>
          <button
            onClick={() => { setBuildOnQuestion(null); setShowNewForm(true); }}
            className="text-sm bg-indigo-600 text-white rounded-xl px-4 py-2 hover:bg-indigo-500 transition-colors font-semibold shadow-sm"
          >
            + {t.board.addQuestion}
          </button>
        </div>
      </header>

      {/* Category filter bar */}
      <div className="bg-white/80 border-b border-slate-100 px-4 py-2.5 overflow-x-auto">
        <CategoryFilter
          categories={categories}
          selected={categoryFilter}
          lang={lang}
          onChange={setCategoryFilter}
        />
      </div>

      {/* Main content + Live Feed sidebar */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        <main className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              {t.common.loading}
            </div>
          ) : (
            <QuestionList
              questions={filteredQuestions}
              voterId={participant.id}
              lang={lang}
              highlightId={highlightId}
              onBuildOn={handleBuildOn}
              onVoteChange={handleVoteChange}
            />
          )}
        </main>
        <aside className="hidden md:flex w-64 shrink-0 flex-col overflow-hidden">
          <LiveFeed questions={questions} lang={lang} onSelect={handleFeedSelect} />
        </aside>
      </div>

      {/* New note modal */}
      {showNewForm && (
        <NewNoteForm
          sessionId={sessionId}
          authorName={participant.name}
          authorAffiliation={participant.affiliation}
          parent={
            buildOnQuestion
              ? { id: buildOnQuestion.id, content: buildOnQuestion.content, author_name: buildOnQuestion.author_name }
              : null
          }
          lang={lang}
          onClose={() => { setShowNewForm(false); setBuildOnQuestion(null); }}
          onSubmitted={fetchQuestions}
        />
      )}
    </div>
  );
}
