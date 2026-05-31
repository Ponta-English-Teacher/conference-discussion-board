'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SessionDetail from './SessionDetail';

const STORAGE_KEY = 'moderator_auth';

interface Props {
  sessionId: string;
}

export default function ModeratorSessionPage({ sessionId }: Props) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(STORAGE_KEY) !== 'true') {
      router.replace('/moderator');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <SessionDetail sessionId={sessionId} />;
}
