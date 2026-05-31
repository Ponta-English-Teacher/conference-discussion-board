'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/useLanguage';
import ModeratorPanel from '@/components/moderator/ModeratorPanel';

const STORAGE_KEY = 'moderator_auth';

export default function ModeratorPage() {
  const { lang, t } = useLanguage();
  const tm = t.moderator;
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Resume session across page refreshes
    if (sessionStorage.getItem(STORAGE_KEY) === 'true') setAuthenticated(true);
    setChecking(false);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_MODERATOR_PASSWORD;
    if (password === expected) {
      sessionStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
    } else {
      setError(tm.wrongPassword);
    }
  }

  if (checking) return null;

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-8 flex flex-col gap-5">
          <h1 className="font-semibold text-lg text-center">{tm.title}</h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <label className="text-sm font-medium text-gray-700">{tm.passwordLabel}</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder={tm.passwordPlaceholder}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              autoFocus
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              className="bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              {tm.login}
            </button>
          </form>
          <p className="text-xs text-gray-400 text-center">
            {lang === 'en'
              ? 'Moderator access only. Contact the session organizer for the password.'
              : 'モデレーター専用。パスワードはセッション主催者にお問い合わせください。'}
          </p>
        </div>
      </div>
    );
  }

  return <ModeratorPanel />;
}
