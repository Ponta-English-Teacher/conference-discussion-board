import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/questions/:id/vote  — toggle vote (insert or delete)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: questionId } = await params;
  const { voter_id } = await req.json();

  if (!voter_id) {
    return NextResponse.json({ error: 'voter_id required' }, { status: 400 });
  }

  const db = createServerClient();

  // Check for existing vote
  const { data: existing } = await db
    .from('cdb_votes')
    .select('id')
    .eq('question_id', questionId)
    .eq('voter_id', voter_id)
    .maybeSingle();

  if (existing) {
    // Remove vote (toggle off)
    await db.from('cdb_votes').delete().eq('id', existing.id);
    return NextResponse.json({ voted: false });
  } else {
    // Add vote
    const { error } = await db.from('cdb_votes').insert({ question_id: questionId, voter_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ voted: true });
  }
}
