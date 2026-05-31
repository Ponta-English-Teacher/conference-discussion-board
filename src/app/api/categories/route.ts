import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { translateText } from '@/lib/openai';

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

  const hasEn = !!label?.trim();
  const hasJa = !!label_ja?.trim();

  if (!session_id || (!hasEn && !hasJa)) {
    return NextResponse.json(
      { error: 'session_id and at least one label (EN or JA) are required' },
      { status: 400 }
    );
  }

  let finalLabel: string = label?.trim() || '';
  let finalLabelJa: string | null = label_ja?.trim() || null;

  if (hasEn && !hasJa) {
    // Moderator entered EN only — try to generate JA
    try {
      finalLabelJa = await Promise.race([
        translateText(finalLabel, 'en-to-ja'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
    } catch {
      finalLabelJa = null; // AI failed — leave blank, do not block creation
    }
  } else if (hasJa && !hasEn) {
    // Moderator entered JA only — try to generate EN
    // label is NOT NULL in the DB, so fall back to the JA text if AI fails
    try {
      const generated = await Promise.race([
        translateText(finalLabelJa!, 'ja-to-en'),
        new Promise<null>(resolve => setTimeout(() => resolve(null), 5000)),
      ]);
      finalLabel = generated ?? finalLabelJa!;
    } catch {
      finalLabel = finalLabelJa!;
    }
  }

  const db = createServerClient();
  const { data, error } = await db
    .from('cdb_categories')
    .insert({ session_id, label: finalLabel, label_ja: finalLabelJa })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
