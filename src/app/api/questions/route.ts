import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/questions?session_id=<id>&voter_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get('session_id');
  const voterId = searchParams.get('voter_id') ?? '';

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: questions, error } = await db
    .from('cdb_questions_with_votes')
    .select('*, category:cdb_categories(*), parent:cdb_questions!parent_id(id, content, author_name)')
    .eq('session_id', sessionId)
    .order('vote_count', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Annotate which questions the current voter has voted on
  let votedQuestionIds: Set<string> = new Set();
  if (voterId) {
    const { data: votes } = await db
      .from('cdb_votes')
      .select('question_id')
      .eq('voter_id', voterId);
    if (votes) votedQuestionIds = new Set(votes.map(v => v.question_id));
  }

  const enriched = (questions ?? []).map(q => ({
    ...q,
    voted_by_me: votedQuestionIds.has(q.id),
  }));

  return NextResponse.json(enriched);
}

// POST /api/questions
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { session_id, content, author_name, author_affiliation, parent_id } = body;

  if (!session_id || !content?.trim() || !author_name?.trim() || !author_affiliation?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const db = createServerClient();

  const { data, error } = await db
    .from('cdb_questions')
    .insert({
      session_id,
      content: content.trim(), // stored as-is, never mutated
      author_name: author_name.trim(),
      author_affiliation: author_affiliation.trim(),
      parent_id: parent_id ?? null,
      category_id: null, // always starts as Uncategorized
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
