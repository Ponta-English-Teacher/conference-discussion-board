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
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}
      >
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h1 className="font-bold text-xl text-slate-800 tracking-tight">{tm.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'en' ? 'Moderator access only' : 'モデレーター専用'}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-8">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">{tm.passwordLabel}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder={tm.passwordPlaceholder}
                  className="border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
                  autoFocus
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                className="bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-500 transition-colors shadow-sm"
              >
                {tm.login}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return <ModeratorPanel />;
}
