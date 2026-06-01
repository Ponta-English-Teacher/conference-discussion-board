import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { classifyQuestion, translateText } from '@/lib/openai';

// GET /api/questions?session_id=<id>&voter_id=<id>
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const sessionId = searchParams.get('session_id');
  const voterId = searchParams.get('voter_id') ?? '';

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const db = createServerClient();

  // !category_id disambiguates the FK path: cdb_questions.category_id → cdb_categories.id
  // After the bilingual migration, cdb_categories also references cdb_questions (representative/trigger),
  // which would otherwise make PostgREST unable to pick the right join direction.
  const { data: questions, error } = await db
    .from('cdb_questions')
    .select('*, category:cdb_categories!category_id(id, session_id, label, label_ja), parent:cdb_questions!parent_id(id, content, author_name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questionIds = (questions ?? []).map(q => q.id);

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
  const { session_id, content, context, author_name, author_affiliation, parent_id, lang } = body;

  if (!session_id || !content?.trim() || !author_name?.trim() || !author_affiliation?.trim()) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const trimmedContext = context?.trim() || null;

  // Detect content language from the actual text, not the UI toggle.
  // A participant may type in English while the UI is in Japanese mode, or vice versa.
  // Hiragana U+3040–U+30FF, Katakana U+30A0–U+30FF, CJK Unified Ideographs U+4E00–U+9FAF
  function detectLang(text: string): 'en' | 'ja' {
    return /[぀-ヿ一-龯]/.test(text) ? 'ja' : 'en';
  }

  const submissionLang = detectLang(content.trim());
  const translateDir = submissionLang === 'en' ? 'en-to-ja' : 'ja-to-en';

  const db = createServerClient();

  // Insert the question immediately — content and context are stored as immutable originals.
  // Same-language columns are pre-filled as copies (no AI needed); other-language columns start null.
  const { data: question, error } = await db
    .from('cdb_questions')
    .insert({
      session_id,
      content: content.trim(),       // immutable original — never update this
      context: trimmedContext,        // immutable original — never update this
      author_name: author_name.trim(),
      author_affiliation: author_affiliation.trim(),
      parent_id: parent_id ?? null,
      category_id: null,
      content_en: submissionLang === 'en' ? content.trim() : null,
      content_ja: submissionLang === 'ja' ? content.trim() : null,
      context_en: submissionLang === 'en' ? trimmedContext : null,
      context_ja: submissionLang === 'ja' ? trimmedContext : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch categories for AI classification
  const { data: categories } = await db
    .from('cdb_categories')
    .select('id, label, label_ja')
    .eq('session_id', session_id);

  // Promise that resolves null after ms — used to cap AI call durations
  const timeout = (ms: number): Promise<null> =>
    new Promise(resolve => setTimeout(() => resolve(null), ms));

  // Categorization and translation run in parallel — total wait ≈ max(4s, 3s) = 4s
  const [aiCategoryId, translatedContent, translatedContext] = await Promise.all([
    categories?.length
      ? Promise.race([
          classifyQuestion(content.trim(), categories, trimmedContext).catch(() => null),
          timeout(4000),
        ])
      : Promise.resolve(null),

    Promise.race([
      translateText(content.trim(), translateDir).catch(() => null),
      timeout(3000),
    ]),

    trimmedContext
      ? Promise.race([
          translateText(trimmedContext, translateDir).catch(() => null),
          timeout(3000),
        ])
      : Promise.resolve(null),
  ]);

  // Build a single UPDATE — content and context columns are never included here
  const updates: Record<string, string | null> = {};

  if (aiCategoryId) {
    updates.category_id = aiCategoryId;
  }

  if (translatedContent) {
    if (submissionLang === 'en') {
      updates.content_ja = translatedContent;
      if (translatedContext) updates.context_ja = translatedContext;
    } else {
      updates.content_en = translatedContent;
      if (translatedContext) updates.context_en = translatedContext;
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.from('cdb_questions').update(updates).eq('id', question.id);
  }

  return NextResponse.json({ ...question, ...updates }, { status: 201 });
}
