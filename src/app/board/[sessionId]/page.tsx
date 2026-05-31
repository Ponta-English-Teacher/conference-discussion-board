import BoardPage from '@/components/board/BoardPage';

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <BoardPage sessionId={sessionId} />;
}
