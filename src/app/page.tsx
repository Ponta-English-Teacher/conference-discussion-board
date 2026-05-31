import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center gap-4">
      <h1 className="text-2xl font-semibold text-gray-800">Conference Discussion Board</h1>
      <p className="text-gray-500 text-sm max-w-sm">
        To join a discussion board, please use the session link provided by your moderator.
      </p>
      <p className="text-gray-400 text-xs max-w-sm">
        ディスカッションボードに参加するには、モデレーターから提供されたセッションリンクをご使用ください。
      </p>
      <Link
        href="/moderator"
        className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors"
      >
        Moderator login
      </Link>
    </div>
  );
}
