import { NextRequest, NextResponse } from 'next/server';
import { workshopChat } from '@/lib/openai';
import type { WorkshopMessage } from '@/lib/openai';

// POST /api/workshop/chat
// Stateless — receives full context each call, writes nothing to the database.
// Body: { question, draft, messages, newMessage }
//   question   — participant question fields for context
//   draft      — moderator's current draft text
//   messages   — in-memory conversation history (user+assistant pairs, excluding newMessage)
//   newMessage — the moderator's latest turn
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question, draft, messages, newMessage } = body;

  if (!question?.content || typeof newMessage !== 'string' || !newMessage.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const history: WorkshopMessage[] = Array.isArray(messages) ? messages : [];

  const fullConversation: WorkshopMessage[] = [
    ...history,
    { role: 'user', content: newMessage.trim() },
  ];

  const reply = await workshopChat(
    {
      content: question.content,
      content_en: question.content_en ?? null,
      content_ja: question.content_ja ?? null,
      context: question.context ?? null,
    },
    typeof draft === 'string' ? draft : '',
    fullConversation
  ).catch(() => null);

  if (!reply) {
    return NextResponse.json({ error: 'AI unavailable — please try again.' }, { status: 503 });
  }

  return NextResponse.json({ reply });
}
