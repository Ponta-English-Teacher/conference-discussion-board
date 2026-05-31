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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gray-50">
      <button
        onClick={toggle}
        className="absolute top-4 right-4 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded px-3 py-1 transition-colors"
      >
        {lang === 'en' ? '日本語' : 'English'}
      </button>

      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-1 tracking-tight">
          {sessionTitle}
        </h1>
        <p className="text-center text-gray-500 mb-8 text-sm">
          {t.landing.subtitle}
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t.landing.nameLabel}
            </label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder={t.landing.namePlaceholder}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t.landing.affiliationLabel}
            </label>
            <input
              type="text"
              value={affiliation}
              onChange={e => { setAffiliation(e.target.value); setError(''); }}
              placeholder={t.landing.affiliationPlaceholder}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            className="mt-2 bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            {t.landing.enterButton}
          </button>
        </form>
      </div>
    </div>
  );
}
