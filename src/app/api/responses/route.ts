import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { translateText } from '@/lib/openai';

// GET /api/responses?session_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const db = createServerClient();

  const { data: questions } = await db
    .from('cdb_questions')
    .select('id')
    .eq('session_id', sessionId);

  const questionIds = (questions ?? []).map((q: { id: string }) => q.id);

  if (questionIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: responses, error } = await db
    .from('cdb_responses')
    .select('*')
    .in('question_id', questionIds)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(responses ?? []);
}

// POST /api/responses
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { question_id, content, author_name, author_affiliation } = body;

  if (!question_id || !content?.trim() || !author_name?.trim() || !author_affiliation?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  function detectLang(text: string): 'en' | 'ja' {
    return /[぀-ヿ一-龯]/.test(text) ? 'ja' : 'en';
  }

  const submissionLang = detectLang(content.trim());
  const translateDir = submissionLang === 'en' ? 'en-to-ja' : 'ja-to-en';

  const db = createServerClient();

  const { data: response, error } = await db
    .from('cdb_responses')
    .insert({
      question_id,
      content: content.trim(),       // immutable original — never update this
      author_name: author_name.trim(),
      author_affiliation: author_affiliation.trim(),
      content_en: submissionLang === 'en' ? content.trim() : null,
      content_ja: submissionLang === 'ja' ? content.trim() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const timeout = (ms: number): Promise<null> =>
    new Promise(resolve => setTimeout(() => resolve(null), ms));

  const [translatedContent] = await Promise.all([
    Promise.race([
      translateText(content.trim(), translateDir).catch(() => null),
      timeout(3000),
    ]),
  ]);

  const updates: Record<string, string | null> = {};
  if (translatedContent) {
    if (submissionLang === 'en') {
      updates.content_ja = translatedContent;
    } else {
      updates.content_en = translatedContent;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.from('cdb_responses').update(updates).eq('id', response.id);
  }

  return NextResponse.json({ ...response, ...updates }, { status: 201 });
}
