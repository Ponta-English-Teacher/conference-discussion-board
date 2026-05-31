import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// DELETE /api/categories/:categoryId
// ON DELETE SET NULL on cdb_questions.category_id reassigns affected questions
// to Uncategorized automatically at the DB level — no application migration needed.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> }
) {
  const { categoryId } = await params;

  const db = createServerClient();
  const { error } = await db
    .from('cdb_categories')
    .delete()
    .eq('id', categoryId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
