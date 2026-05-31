import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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

  if (!title?.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_sessions')
    .insert({
      title: title.trim(),
      title_ja: title_ja?.trim() || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
