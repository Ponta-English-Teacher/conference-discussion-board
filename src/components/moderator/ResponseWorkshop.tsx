'use client';

import { useState, useRef, useEffect } from 'react';
import type { Question } from '@/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  question: Question;
  lang: 'en' | 'ja';
  onResponseSubmitted: () => void;
}

// Parses the AI's structured output into an understanding note and clean response text.
// Expected format:
//   UNDERSTANDING: [one sentence]
//   ---
//   [clean participant-facing text]
// Falls back gracefully when the AI doesn't follow the format exactly.
function parseAIResponse(raw: string): { understanding: string; response: string } {
  const sepIndex = raw.indexOf('---');
  if (sepIndex === -1) return { understanding: '', response: raw.trim() };
  const before = raw.slice(0, sepIndex).trim();
  const after = raw.slice(sepIndex + 3).trim();
  const prefix = 'UNDERSTANDING:';
  const understanding = before.toUpperCase().startsWith(prefix)
    ? before.slice(prefix.length).trim()
    : before;
  return { understanding, response: after };
}

export default function ResponseWorkshop({ question, lang, onResponseSubmitted }: Props) {
  const [open, setOpen] = useState(false);

  // Draft — the primary working document, persisted to DB via auto-save
  const [draft, setDraftState] = useState('');
  const [draftStatus, setDraftStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  // AI context — invisible, used only for multi-turn coherence within a suggestion cycle
  const [messages, setMessages] = useState<Message[]>([]);

  // Suggestion — editable candidate text from the latest AI turn
  // The moderator may tweak this directly before accepting it into the draft.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [understanding, setUnderstanding] = useState('');

  // Refinement instruction — for follow-up requests inside the suggestion panel
  const [instruction, setInstruction] = useState('');

  // Loading / error / action states
  const [chatLoading, setChatLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear save timer on unmount
  useEffect(() => {
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, []);

  // Fetch draft from DB when workshop opens; clear all transient state when it closes
  useEffect(() => {
    if (!open) {
      setMessages([]);
      setSuggestion(null);
      setUnderstanding('');
      setInstruction('');
      setAiError('');
      return;
    }
    fetch(`/api/response-drafts/${question.id}`)
      .then(r => r.ok ? r.json() : { content: '' })
      .then(data => {
        setDraftState(data.content ?? '');
        setDraftStatus('saved');
      })
      .catch(() => {});
  }, [open, question.id]);

  // User-initiated draft change — schedules debounced auto-save to DB
  function setDraftFromUser(value: string) {
    setDraftState(value);
    setDraftStatus('unsaved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setDraftStatus('saving');
      try {
        await fetch(`/api/response-drafts/${question.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: value }),
        });
        setDraftStatus('saved');
      } catch {
        setDraftStatus('unsaved');
      }
    }, 1500);
  }

  // Sends a message to the AI.
  // Primary trigger (overrideText provided): clears conversation history so the AI
  // starts fresh from the current draft, ignoring previous suggestion cycles.
  // Follow-up instruction (no overrideText): keeps history for short-term context.
  async function sendMessage(overrideText?: string) {
    const text = overrideText ?? instruction.trim();
    if (!text || chatLoading) return;

    const historyBeforeSend = overrideText ? [] : messages;
    if (overrideText) setMessages([]);
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    if (!overrideText) setInstruction('');
    setChatLoading(true);
    setAiError('');

    try {
      const res = await fetch('/api/workshop/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: {
            content: question.content,
            content_en: question.content_en,
            content_ja: question.content_ja,
            context: question.context,
          },
          draft,
          messages: historyBeforeSend,
          newMessage: text,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = parseAIResponse(data.reply);
        setUnderstanding(parsed.understanding);
        setSuggestion(parsed.response);
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setAiError(lang === 'ja'
          ? 'AIが応答できませんでした。もう一度お試しください。'
          : 'AI could not respond. Please try again.');
      }
    } catch {
      setAiError(lang === 'ja'
        ? 'ネットワークエラーが発生しました。'
        : 'Network error — please try again.');
    } finally {
      setChatLoading(false);
    }
  }

  // Applies the (possibly moderator-edited) suggestion text to the draft and clears the panel
  function useRevision() {
    if (!suggestion) return;
    setDraftFromUser(suggestion);
    setSuggestion(null);
    setUnderstanding('');
    setInstruction('');
  }

  function dismissSuggestion() {
    setSuggestion(null);
    setUnderstanding('');
    setInstruction('');
  }

  async function handlePublish() {
    if (!draft.trim() || publishing) return;
    setPublishing(true);
    try {
      const res = await fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_id: question.id,
          content: draft.trim(),
          author_name: lang === 'ja' ? 'モデレーター' : 'Moderator',
          author_affiliation: lang === 'ja' ? 'セッション主催者' : 'Session Host',
        }),
      });
      if (res.ok) {
        await fetch(`/api/response-drafts/${question.id}`, { method: 'DELETE' }).catch(() => {});
        setDraftState('');
        setMessages([]);
        setSuggestion(null);
        setUnderstanding('');
        setInstruction('');
        setAiError('');
        setOpen(false);
        onResponseSubmitted();
      }
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscard() {
    if (discarding) return;
    setDiscarding(true);
    try {
      await fetch(`/api/response-drafts/${question.id}`, { method: 'DELETE' }).catch(() => {});
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setDraftState('');
      setDraftStatus('saved');
      setMessages([]);
      setSuggestion(null);
      setUnderstanding('');
      setInstruction('');
      setAiError('');
      setOpen(false);
    } finally {
      setDiscarding(false);
    }
  }

  const statusLabel =
    draftStatus === 'saving'  ? (lang === 'ja' ? '保存中…' : 'Saving…') :
    draftStatus === 'unsaved' ? (lang === 'ja' ? '未保存' : 'Unsaved') :
    (lang === 'ja' ? '保存済み' : 'Saved');

  const primaryQ = lang === 'ja'
    ? (question.content_ja ?? question.content)
    : (question.content_en ?? question.content);
  const secondaryQ = lang === 'ja' ? question.content_en : question.content_ja;
  const displayContext = lang === 'ja'
    ? (question.context_ja ?? question.context)
    : (question.context_en ?? question.context);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors"
      >
        ✦ {lang === 'ja' ? '回答ワークショップを開く' : 'Open Response Workshop'}
      </button>
    );
  }

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50/30 px-4 py-3"
      style={{ borderLeft: '3px solid #7C3AED' }}
    >
      {/* Workshop header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-violet-700 uppercase tracking-wide">
          {lang === 'ja' ? '回答ワークショップ' : 'Response Workshop'}
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          {lang === 'ja' ? '閉じる' : 'Close'}
        </button>
      </div>

      {/* Participant question — read-only context */}
      <div className="rounded-lg bg-white border border-slate-200/80 px-3 py-2.5 flex flex-col gap-1">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
          {lang === 'ja' ? '参加者の質問' : 'Participant Question'}
        </span>
        <p className="text-sm text-slate-700 leading-snug font-medium">{primaryQ}</p>
        {secondaryQ && (
          <p className="text-xs text-slate-400 leading-snug">{secondaryQ}</p>
        )}
        {displayContext && (
          <p className="text-xs text-slate-500 leading-relaxed mt-0.5 pt-1.5 border-t border-slate-100">
            {displayContext}
          </p>
        )}
      </div>

      {/* Moderator draft — the primary working document */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">
            {lang === 'ja' ? 'あなたの下書き' : 'Your Draft'}
          </span>
          <span className={`text-xs font-medium ${
            draftStatus === 'unsaved' ? 'text-amber-500' :
            draftStatus === 'saving'  ? 'text-slate-400' :
            'text-emerald-600'
          }`}>
            {statusLabel}
          </span>
        </div>
        <textarea
          value={draft}
          onChange={e => setDraftFromUser(e.target.value)}
          placeholder={lang === 'ja'
            ? '回答の下書きをここに書いてください…'
            : 'Write your draft response here…'}
          rows={4}
          className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition resize-none bg-white leading-relaxed"
        />
        {/* Primary AI action — clears history and starts fresh from the current draft */}
        <button
          onClick={() => sendMessage(
            lang === 'ja'
              ? '下書きを確認して、参加者への回答として表現する案を提案してください。'
              : 'Please review my draft and suggest how I might say this to participants.'
          )}
          disabled={!draft.trim() || chatLoading}
          className="self-start text-xs bg-violet-600 text-white rounded-lg px-3 py-1.5 hover:bg-violet-500 transition-colors font-semibold disabled:opacity-50"
        >
          {lang === 'ja' ? 'この下書きをAIに相談する' : 'Ask AI about this draft'}
        </button>
      </div>

      {/* Suggested Revision panel — appears while loading or when a suggestion exists.
          The refinement input lives here so it is only visible in context of a suggestion. */}
      {(suggestion !== null || chatLoading) && (
        <div className="flex flex-col gap-3 rounded-xl border border-violet-300 bg-white px-4 py-3">
          <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">
            {lang === 'ja' ? '改訂案' : 'Suggested Revision'}
          </span>

          {suggestion !== null ? (
            <>
              {/* AI understanding note — small, italic, above the editable text */}
              {understanding && (
                <p className="text-xs text-slate-500 italic leading-snug -mb-1">
                  {understanding}
                </p>
              )}

              {/* Editable suggestion textarea — moderator can tweak before accepting */}
              <textarea
                value={suggestion}
                onChange={e => setSuggestion(e.target.value)}
                rows={7}
                className="w-full text-sm text-slate-800 leading-relaxed border border-violet-200 bg-violet-50/40 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition resize-none"
              />

              {/* Refinement instruction — follow-up requests maintain short-term AI context */}
              <div className="flex gap-2 items-end border-t border-violet-100 pt-2">
                <textarea
                  value={instruction}
                  onChange={e => setInstruction(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                  }}
                  placeholder={lang === 'ja'
                    ? '「短く」「日本語版も」「もっと前向きに」… (Shift+Enter で改行)'
                    : '"Make it shorter", "Japanese version", "More encouraging"… (Shift+Enter for new line)'}
                  rows={2}
                  disabled={chatLoading}
                  className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent transition resize-none bg-white disabled:opacity-50 leading-snug"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={chatLoading || !instruction.trim()}
                  className="px-3 py-2 bg-violet-600 text-white rounded-xl hover:bg-violet-500 transition-colors text-sm font-semibold disabled:opacity-50 shrink-0"
                >
                  {lang === 'ja' ? 'AIに聞く' : 'Ask AI'}
                </button>
              </div>

              {/* Action buttons — hidden while follow-up is loading */}
              {chatLoading ? (
                <p className="text-xs text-slate-400 italic text-right">
                  {lang === 'ja' ? '更新中…' : 'Updating suggestion…'}
                </p>
              ) : (
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={dismissSuggestion}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-50"
                  >
                    {lang === 'ja' ? '却下' : 'Dismiss'}
                  </button>
                  <button
                    onClick={useRevision}
                    className="text-xs bg-violet-600 text-white rounded-lg px-3 py-1.5 hover:bg-violet-500 transition-colors font-semibold"
                  >
                    {lang === 'ja' ? '改訂案を使う' : 'Use Revised Response'}
                  </button>
                </div>
              )}
            </>
          ) : (
            /* First AI call in progress — no suggestion yet */
            <p className="text-xs text-slate-400 italic">
              {lang === 'ja' ? 'AIが考えています…' : 'AI is thinking…'}
            </p>
          )}
        </div>
      )}

      {/* AI error — shown outside the suggestion panel so it is visible even when panel is absent */}
      {aiError && (
        <p className="text-xs text-red-500 leading-snug">{aiError}</p>
      )}

      {/* Publish / Discard */}
      <div className="flex items-center justify-between pt-1 border-t border-violet-100">
        <button
          onClick={handleDiscard}
          disabled={discarding}
          className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium disabled:opacity-50"
        >
          {discarding
            ? (lang === 'ja' ? '削除中…' : 'Discarding…')
            : (lang === 'ja' ? '下書きを破棄' : 'Discard Draft')}
        </button>
        <button
          onClick={handlePublish}
          disabled={publishing || !draft.trim()}
          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-colors font-semibold shadow-sm disabled:opacity-50"
        >
          {publishing
            ? (lang === 'ja' ? '投稿中…' : 'Posting…')
            : (lang === 'ja' ? '公式回答として投稿' : 'Post Official Response')}
        </button>
      </div>
    </div>
  );
}
