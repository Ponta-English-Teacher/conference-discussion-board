import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// PATCH /api/questions/:id  — moderator-only: assign category or parent
// content is never touched here — immutability enforced at route level
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Only allow updating these two fields — never content
  const allowed = ['category_id', 'parent_id'];
  const update: Record<string, string | null> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key] ?? null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_questions')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
