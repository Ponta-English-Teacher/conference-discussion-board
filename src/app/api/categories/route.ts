import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

// GET /api/categories?session_id=<id>
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 });

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_categories')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/categories  — moderator only
export async function POST(req: NextRequest) {
  const { session_id, label, label_ja } = await req.json();

  if (!session_id || !label?.trim()) {
    return NextResponse.json({ error: 'session_id and label required' }, { status: 400 });
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_categories')
    .insert({ session_id, label: label.trim(), label_ja: label_ja?.trim() ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
