import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { classifyQuestion } from '@/lib/openai';

// GET /api/questions?session_id=<id>&voter_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get('session_id');
  const voterId = searchParams.get('voter_id') ?? '';

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const db = createServerClient();

  // Query the base table (not the view) — PostgREST can only traverse FK
  // relations on base tables, not on views with aggregations.
  const { data: questions, error } = await db
    .from('cdb_questions')
    .select('*, category:cdb_categories!category_id(id, session_id, label, label_ja), parent:cdb_questions!parent_id(id, content, author_name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questionIds = (questions ?? []).map(q => q.id);

  // Single vote query covers both vote counts and voted_by_me annotation
  const voteCountMap = new Map<string, number>();
  const votedQuestionIds = new Set<string>();

  if (questionIds.length > 0) {
    const { data: allVotes } = await db
      .from('cdb_votes')
      .select('question_id, voter_id')
      .in('question_id', questionIds);

    allVotes?.forEach(v => {
      voteCountMap.set(v.question_id, (voteCountMap.get(v.question_id) ?? 0) + 1);
      if (voterId && v.voter_id === voterId) votedQuestionIds.add(v.question_id);
    });
  }

  const enriched = (questions ?? [])
    .map(q => ({
      ...q,
      vote_count: voteCountMap.get(q.id) ?? 0,
      voted_by_me: votedQuestionIds.has(q.id),
    }))
    .sort((a, b) =>
      b.vote_count - a.vote_count ||
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

  return NextResponse.json(enriched);
}

// POST /api/questions
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { session_id, content, context, author_name, author_affiliation, parent_id } = body;

  if (!session_id || !content?.trim() || !author_name?.trim() || !author_affiliation?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const trimmedContext = context?.trim() || null;

  const db = createServerClient();

  const { data: question, error } = await db
    .from('cdb_questions')
    .insert({
      session_id,
      content: content.trim(),  // stored as-is, never mutated
      context: trimmedContext,  // stored as-is, never mutated; null if not provided
      author_name: author_name.trim(),
      author_affiliation: author_affiliation.trim(),
      parent_id: parent_id ?? null,
      category_id: null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // AI categorization — runs synchronously with a 4s timeout so the board
  // receives the category in the same response. Falls back to Uncategorized
  // silently on timeout or any OpenAI error; original content is never touched.
  const { data: categories } = await db
    .from('cdb_categories')
    .select('id, label, label_ja')
    .eq('session_id', session_id);

  if (categories?.length) {
    try {
      const aiCategoryId = await Promise.race([
        classifyQuestion(content.trim(), categories, trimmedContext),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 4000)),
      ]);
      if (aiCategoryId) {
        await db
          .from('cdb_questions')
          .update({ category_id: aiCategoryId })
          .eq('id', question.id);
        return NextResponse.json({ ...question, category_id: aiCategoryId }, { status: 201 });
      }
    } catch {
      // AI unavailable — return Uncategorized without failing the submission
    }
  }

  return NextResponse.json(question, { status: 201 });
}
