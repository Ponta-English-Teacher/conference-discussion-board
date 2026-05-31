'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useLanguage } from '@/lib/useLanguage';
import { setParticipant } from '@/lib/participant';
import type { Participant } from '@/types';

interface Props {
  sessionId: string;
  sessionTitle: string;
  onEntered: (participant: Participant) => void;
}

export default function EntryForm({ sessionId, sessionTitle, onEntered }: Props) {
  const { lang, toggle, t } = useLanguage();
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedAffiliation = affiliation.trim();
    if (!trimmedName || !trimmedAffiliation) {
      setError(t.landing.required);
      return;
    }
    const participant: Participant = {
      id: uuidv4(),
      name: trimmedName,
      affiliation: trimmedAffiliation,
      session_id: sessionId,
    };
    setParticipant(participant);
    onEntered(participant);
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}
    >
      <button
        onClick={toggle}
        className="absolute top-4 right-4 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-full px-3 py-1.5 bg-white/80 hover:bg-white transition-colors shadow-sm"
      >
        {lang === 'en' ? '日本語' : 'English'}
      </button>

      <div className="w-full max-w-md">
        {/* Session branding */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-indigo-600 items-center justify-center shadow-lg mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight leading-snug">
            {sessionTitle || t.landing.title}
          </h1>
          <p className="text-slate-500 mt-2 text-sm">{t.landing.subtitle}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              {t.landing.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder={t.landing.namePlaceholder}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700">
              {t.landing.affiliationLabel}
            </label>
            <input
              type="text"
              value={affiliation}
              onChange={e => { setAffiliation(e.target.value); setError(''); }}
              placeholder={t.landing.affiliationPlaceholder}
              className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="mt-1 bg-indigo-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-indigo-500 transition-colors shadow-sm"
          >
            {t.landing.enterButton}
          </button>
        </div>
      </div>
    </div>
  );
}
