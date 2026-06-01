import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// POST /api/sessions/:sessionId/reset
// Deletes all questions (and votes via CASCADE) for the session.
// The session itself, categories, and all bilingual labels are preserved.
// ON DELETE SET NULL on cdb_categories.representative_question_id / discussion_trigger_question_id
// is handled automatically by the database.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createServerClient();

  const { error } = await db
    .from('cdb_questions')
    .delete()
    .eq('session_id', sessionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
