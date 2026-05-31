'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { getParticipant } from '@/lib/participant';
import { useLanguage } from '@/lib/useLanguage';
import type { Category, Question, Session, Participant } from '@/types';
import EntryForm from '@/components/landing/EntryForm';
import NoteGrid from '@/components/board/NoteGrid';
import CategoryFilter from '@/components/board/CategoryFilter';
import NewNoteForm from '@/components/board/NewNoteForm';

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

  // Check sessionStorage for an existing participant for this specific session
  useEffect(() => {
    setParticipant(getParticipant(sessionId));
  }, [sessionId]);

  // Load this session by ID
  useEffect(() => {
    supabase
      .from('cdb_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()
      .then(({ data }) => {
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-base">{sessionTitle}</h1>
          <p className="text-xs text-gray-400">{participant.name} · {participant.affiliation}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
          >
            {lang === 'en' ? '日本語' : 'English'}
          </button>
          <button
            onClick={() => { setBuildOnQuestion(null); setShowNewForm(true); }}
            className="text-sm bg-gray-900 text-white rounded-lg px-4 py-2 hover:bg-gray-700 transition-colors"
          >
            + {t.board.addQuestion}
          </button>
        </div>
      </header>

      {/* Category filter bar */}
      <div className="bg-white border-b border-gray-100 px-4 py-2 overflow-x-auto">
        <CategoryFilter
          categories={categories}
          selected={categoryFilter}
          lang={lang}
          onChange={setCategoryFilter}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
            {t.common.loading}
          </div>
        ) : (
          <NoteGrid
            questions={filteredQuestions}
            voterId={participant.id}
            lang={lang}
            onBuildOn={handleBuildOn}
            onVoteChange={handleVoteChange}
          />
        )}
      </main>

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
