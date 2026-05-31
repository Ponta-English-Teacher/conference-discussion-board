import type { Participant } from '@/types';

// Each session gets its own storage key so a participant can join multiple sessions
// in the same browser without being asked to re-enter their details.
function storageKey(sessionId: string) {
  return `participant_${sessionId}`;
}

export function getParticipant(sessionId: string): Participant | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as Participant) : null;
  } catch {
    return null;
  }
}

export function setParticipant(p: Participant): void {
  sessionStorage.setItem(storageKey(p.session_id), JSON.stringify(p));
}

export function clearParticipant(sessionId: string): void {
  sessionStorage.removeItem(storageKey(sessionId));
}
