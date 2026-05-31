import ModeratorSessionPage from '@/components/moderator/ModeratorSessionPage';

export default async function Page({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  return <ModeratorSessionPage sessionId={sessionId} />;
}
