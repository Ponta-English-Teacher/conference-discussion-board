import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { translateText } from '@/lib/openai';

// GET /api/sessions — list all sessions with question counts, newest first
export async function GET() {
  const db = createServerClient();

  const { data: sessions, error } = await db
    .from('cdb_sessions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!sessions?.length) return NextResponse.json([]);

  // Fetch question counts for all sessions in one query
  const { data: questionRows } = await db
    .from('cdb_questions')
    .select('session_id')
    .in('session_id', sessions.map(s => s.id));

  const countMap = new Map<string, number>();
  questionRows?.forEach(q => {
    countMap.set(q.session_id, (countMap.get(q.session_id) ?? 0) + 1);
  });

  const result = sessions.map(s => ({
    ...s,
    question_count: countMap.get(s.id) ?? 0,
  }));

  return NextResponse.json(result);
}

// POST /api/sessions — create a new session (moderator only)
export async function POST(req: NextRequest) {
  const { title, title_ja } = await req.json();

  const hasEn = !!title?.trim();
  const hasJa = !!title_ja?.trim();

  if (!hasEn && !hasJa) {
    return NextResponse.json(
      { error: 'At least one title (EN or JA) is required' },
      { status: 400 }
    );
  }

  let finalTitle: string = title?.trim() || '';
  let finalTitleJa: string | null = title_ja?.trim() || null;

  if (hasEn && !hasJa) {
    // Moderator entered EN only — try to generate JA
    try {
      finalTitleJa = await Promise.race([
        translateText(finalTitle, 'en-to-ja'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
    } catch {
      finalTitleJa = null; // AI failed — leave blank, do not block creation
    }
  } else if (hasJa && !hasEn) {
    // Moderator entered JA only — try to generate EN
    // title is NOT NULL in the DB, so fall back to the JA text if AI fails
    try {
      const generated = await Promise.race([
        translateText(finalTitleJa!, 'ja-to-en'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
      finalTitle = generated ?? finalTitleJa!;
    } catch {
      finalTitle = finalTitleJa!;
    }
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_sessions')
    .insert({ title: finalTitle, title_ja: finalTitleJa, is_active: true })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
