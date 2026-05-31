import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
         style={{ background: 'linear-gradient(135deg, #EEF2FF 0%, #F8F9FF 60%, #FFF7ED 100%)' }}>
      <div className="mb-6 w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-800 mb-2 tracking-tight">
        Conference Discussion Board
      </h1>
      <p className="text-slate-500 text-sm max-w-xs mb-1">
        To join a discussion board, use the session link provided by your moderator.
      </p>
      <p className="text-slate-400 text-xs max-w-xs mb-8">
        ディスカッションボードに参加するには、モデレーターから提供されたリンクをご使用ください。
      </p>

      <Link
        href="/moderator"
        className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-full px-4 py-1.5 hover:bg-indigo-50 transition-colors"
      >
        Moderator login
      </Link>
    </div>
  );
}
