import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/response-drafts/:questionId
// Returns {content, updated_at} or {content: '', updated_at: null} if no draft exists.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const db = createServerClient();

  const { data, error } = await db
    .from('cdb_response_drafts')
    .select('content, updated_at')
    .eq('question_id', questionId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ content: '', updated_at: null });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT /api/response-drafts/:questionId
// Upserts the draft (create or update). Called by debounced auto-save.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const body = await req.json();
  const content = typeof body.content === 'string' ? body.content : '';

  const db = createServerClient();

  const { error } = await db
    .from('cdb_response_drafts')
    .upsert({
      question_id: questionId,
      content,
      updated_at: new Date().toISOString(),
    });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/response-drafts/:questionId
// Removes the draft. Called after publish or explicit discard.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const { questionId } = await params;
  const db = createServerClient();

  const { error } = await db
    .from('cdb_response_drafts')
    .delete()
    .eq('question_id', questionId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
