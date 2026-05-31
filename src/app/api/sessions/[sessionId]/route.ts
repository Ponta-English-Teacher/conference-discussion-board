import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/sessions/:sessionId — fetch a single session by ID (service role key)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json(data);
}

// PATCH /api/sessions/:sessionId — toggle is_active (moderator only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();

  if (typeof body.is_active !== 'boolean') {
    return NextResponse.json({ error: 'is_active (boolean) required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_sessions')
    .update({ is_active: body.is_active })
    .eq('id', sessionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
