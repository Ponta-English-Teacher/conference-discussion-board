import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { organizeQuestions } from '@/lib/openai';

// POST /api/sessions/:sessionId/organize
// Analyzes all questions together, reuses existing categories where appropriate,
// creates new ones only when needed, and reassigns every question.
// Never deletes categories — empty ones are left for the moderator to remove manually.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const db = createServerClient();

  // Fetch all questions for this session (content is never modified here)
  const { data: questions, error: qErr } = await db
    .from('cdb_questions')
    .select('id, content, context')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!questions?.length) {
    return NextResponse.json({ error: 'No questions to organize' }, { status: 422 });
  }

  // Fetch existing categories so the AI can reuse them
  const { data: existingCategories, error: cErr } = await db
    .from('cdb_categories')
    .select('id, label, label_ja')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

  const categories = existingCategories ?? [];

  // Call AI — up to 20s timeout for larger question sets
  let result;
  try {
    result = await Promise.race([
      organizeQuestions(questions, categories),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 20000)),
    ]);
  } catch {
    return NextResponse.json({ error: 'AI request failed' }, { status: 502 });
  }

  if (!result) {
    return NextResponse.json({ error: 'AI did not return a valid result' }, { status: 502 });
  }

  const reusedCategoryIds = new Set<string>();

  // Process each theme assignment
  for (const assignment of result.assignments) {
    let categoryId: string;

    if (assignment.reuse_category_id) {
      // Reuse existing category — update its representative and trigger pointers
      categoryId = assignment.reuse_category_id;
      reusedCategoryIds.add(categoryId);

      const { error } = await db
        .from('cdb_categories')
        .update({
          representative_question_id: assignment.representative_question_id,
          discussion_trigger_question_id: assignment.discussion_trigger_question_id,
        })
        .eq('id', categoryId);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      // Create new category with bilingual label
      const { data: newCat, error } = await db
        .from('cdb_categories')
        .insert({
          session_id: sessionId,
          label: assignment.new_label!,
          label_ja: assignment.new_label_ja ?? null,
          representative_question_id: assignment.representative_question_id,
          discussion_trigger_question_id: assignment.discussion_trigger_question_id,
        })
        .select('id')
        .single();

      if (error || !newCat) return NextResponse.json({ error: error?.message ?? 'Insert failed' }, { status: 500 });
      categoryId = newCat.id;
    }

    // Assign questions to this category (content is never touched)
    if (assignment.question_ids.length > 0) {
      const { error } = await db
        .from('cdb_questions')
        .update({ category_id: categoryId })
        .in('id', assignment.question_ids);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  // Clear representative/trigger on existing categories the AI did not reuse,
  // since their questions have moved. The categories themselves are preserved.
  const nonReusedIds = categories
    .filter(c => !reusedCategoryIds.has(c.id))
    .map(c => c.id);

  if (nonReusedIds.length > 0) {
    await db
      .from('cdb_categories')
      .update({ representative_question_id: null, discussion_trigger_question_id: null })
      .in('id', nonReusedIds);
  }

  // Return all categories for this session (including newly created ones)
  const { data: finalCategories, error: finalErr } = await db
    .from('cdb_categories')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (finalErr) return NextResponse.json({ error: finalErr.message }, { status: 500 });
  return NextResponse.json(finalCategories);
}
