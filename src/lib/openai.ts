import OpenAI from 'openai';

// Lazily initialised so module evaluation never throws during static prerender
let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

interface CategoryOption {
  id: string;
  label: string;
  label_ja: string | null;
}

/**
 * Translates a short text (session title or category name) between English and Japanese.
 * Returns the translated string, or null if the API key is absent or the call fails.
 * Never throws — all errors return null so callers can apply their own fallback.
 */
export async function translateText(
  text: string,
  direction: 'en-to-ja' | 'ja-to-en'
): Promise<string | null> {
  if (!text.trim() || !process.env.OPENAI_API_KEY) return null;

  const [fromLang, toLang] =
    direction === 'en-to-ja' ? ['English', 'Japanese'] : ['Japanese', 'English'];

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 200,
    messages: [
      {
        role: 'system',
        content:
          `You are a translator for an academic conference application. ` +
          `Translate the following ${fromLang} text to ${toLang}. ` +
          `The text is a short session title or category name. ` +
          `Return ONLY the translation. No explanation, no quotes, no extra punctuation.`,
      },
      { role: 'user', content: text.trim() },
    ],
  });

  const result = (response.choices[0]?.message?.content ?? '').trim();
  return result || null;
}

export interface OrganizeInput {
  id: string;
  content: string;
  context: string | null;
}

export interface ExistingCategory {
  id: string;
  label: string;
  label_ja: string | null;
}

export interface ThemeAssignment {
  reuse_category_id: string | null;   // null → create a new category
  new_label: string | null;           // only when reuse_category_id is null
  new_label_ja: string | null;        // only when reuse_category_id is null
  question_ids: string[];
  representative_question_id: string;
  discussion_trigger_question_id: string;
}

export interface OrganizeResult {
  assignments: ThemeAssignment[];
}

/**
 * Analyzes all questions for a session together, groups them into themes,
 * and returns a structured assignment. Reuses existing categories when names
 * are semantically appropriate; creates new categories only when needed.
 * Every question is assigned to exactly one theme.
 * Returns null if the API key is absent or the call fails.
 */
export async function organizeQuestions(
  questions: OrganizeInput[],
  existingCategories: ExistingCategory[]
): Promise<OrganizeResult | null> {
  if (!questions.length || !process.env.OPENAI_API_KEY) return null;

  const questionList = questions
    .map(q => {
      const base = `ID: ${q.id}\nQuestion: ${q.content}`;
      return q.context?.trim() ? `${base}\nContext: ${q.context.trim()}` : base;
    })
    .join('\n\n');

  const categoryList = existingCategories.length
    ? existingCategories
        .map(c => `ID: ${c.id} | ${c.label}${c.label_ja ? ` / ${c.label_ja}` : ''}`)
        .join('\n')
    : '(none)';

  const systemPrompt = `You are an expert conference discussion facilitator.
Your task is to organize a set of conference questions into thematic groups to help a moderator run a structured Q&A session.

Rules:
1. Group all questions into 3–6 meaningful themes. Every question must appear in exactly one group.
2. For each theme, check the existing categories list first. If an existing category name clearly fits the theme, reuse it by setting "reuse_category_id" to its ID. Only set "reuse_category_id" to null when no existing category fits.
3. When creating a new category, provide both "new_label" (English, concise, 2–5 words) and "new_label_ja" (Japanese equivalent).
4. For each theme, pick:
   - "representative_question_id": the question that best represents the theme's core idea
   - "discussion_trigger_question_id": the question most likely to spark lively dialogue (can be the same as representative if needed)
5. Both IDs must be from the question_ids list for that theme.
6. Respond with valid JSON only. No explanation, no markdown fences.

Output schema:
{
  "assignments": [
    {
      "reuse_category_id": "<existing-category-id or null>",
      "new_label": "<English label or null>",
      "new_label_ja": "<Japanese label or null>",
      "question_ids": ["<id>", ...],
      "representative_question_id": "<id>",
      "discussion_trigger_question_id": "<id>"
    }
  ]
}`;

  const userPrompt = `Existing categories:\n${categoryList}\n\nQuestions to organize:\n${questionList}`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = (response.choices[0]?.message?.content ?? '').trim();
  let parsed: OrganizeResult;
  try {
    parsed = JSON.parse(raw) as OrganizeResult;
  } catch {
    return null;
  }

  // Validate: drop any assignment that references unknown IDs
  const validQuestionIds = new Set(questions.map(q => q.id));
  const validCategoryIds = new Set(existingCategories.map(c => c.id));
  const seenQuestionIds = new Set<string>();

  const validAssignments: ThemeAssignment[] = [];
  for (const a of parsed.assignments ?? []) {
    // Filter question_ids to only known, non-duplicate IDs
    const filteredIds = (a.question_ids ?? []).filter(id => {
      if (!validQuestionIds.has(id) || seenQuestionIds.has(id)) return false;
      seenQuestionIds.add(id);
      return true;
    });
    if (!filteredIds.length) continue;

    // Validate reuse_category_id
    const reuseId =
      a.reuse_category_id && validCategoryIds.has(a.reuse_category_id)
        ? a.reuse_category_id
        : null;

    // Skip if no label and no reuse
    if (!reuseId && !a.new_label?.trim()) continue;

    // Validate representative and trigger IDs exist within this group
    const idSet = new Set(filteredIds);
    const rep = idSet.has(a.representative_question_id)
      ? a.representative_question_id
      : filteredIds[0];
    const trigger = idSet.has(a.discussion_trigger_question_id)
      ? a.discussion_trigger_question_id
      : filteredIds[filteredIds.length - 1];

    validAssignments.push({
      reuse_category_id: reuseId,
      new_label: reuseId ? null : (a.new_label?.trim() ?? null),
      new_label_ja: reuseId ? null : (a.new_label_ja?.trim() ?? null),
      question_ids: filteredIds,
      representative_question_id: rep,
      discussion_trigger_question_id: trigger,
    });
  }

  return { assignments: validAssignments };
}

export interface WorkshopMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Language consultant AI for the moderator Response Workshop.
 * Helps the moderator express their own idea more clearly — never answers on their behalf.
 * The participant question and current draft are embedded in the system prompt so
 * the AI always works with the latest context without storing it in conversation history.
 * Returns the AI's reply string, or null if the API key is absent or the call fails.
 */
export async function workshopChat(
  question: {
    content: string;
    content_en: string | null;
    content_ja: string | null;
    context: string | null;
  },
  draft: string,
  messages: WorkshopMessage[]
): Promise<string | null> {
  if (!messages.length || !process.env.OPENAI_API_KEY) return null;

  const questionLines: string[] = [`Original: ${question.content}`];
  if (question.content_en && question.content_en !== question.content)
    questionLines.push(`English: ${question.content_en}`);
  if (question.content_ja && question.content_ja !== question.content)
    questionLines.push(`Japanese: ${question.content_ja}`);
  if (question.context?.trim())
    questionLines.push(`Context/background: ${question.context.trim()}`);

  const questionBlock = questionLines.join('\n');
  const draftBlock = draft.trim() || '(empty — not yet written)';

  const systemPrompt =
    `You are a language consultant and editorial partner helping a conference moderator craft an official response to a participant question.\n\n` +
    `The conference audience includes researchers, practitioners, and students from various countries. ` +
    `Many are non-native English speakers. Responses may be shown in both English and Japanese.\n\n` +
    `PARTICIPANT QUESTION:\n${questionBlock}\n\n` +
    `MODERATOR'S CURRENT DRAFT:\n${draftBlock}\n\n` +
    `CORE PRINCIPLE:\n` +
    `A non-empty draft is evidence of the moderator's intention. Treat it as their expressed position and help them say it better. ` +
    `Do not question whether they mean it.\n\n` +
    `OUTPUT FORMAT — use this exact structure every time:\n\n` +
    `UNDERSTANDING: [One sentence stating how you read the moderator's intention]\n` +
    `---\n` +
    `[Clean, participant-facing response text — nothing else after the ---]\n\n` +
    `Rules for the text after ---:\n` +
    `- It must be clean and immediately usable as a participant-visible response.\n` +
    `- No labels, no "Suggested response:", no "Is this what you want to say?", no explanations.\n` +
    `- Keep it concise — this is a conference Q&A, not an essay.\n` +
    `- Never add ideas or positions the moderator has not expressed.\n\n` +
    `BEHAVIORAL RULES:\n` +
    `1. Always produce a suggested response. Never withhold a suggestion to ask for confirmation first.\n` +
    `2. When the draft is non-empty, act as an editor: improve clarity, tone, and audience fit.\n` +
    `3. When the draft is empty or input is vague, make a best-effort interpretation and produce a suggestion. ` +
    `State your interpretation in the UNDERSTANDING line so the moderator can correct it.\n` +
    `4. For follow-up requests ("shorter", "more encouraging", "Japanese version", "more formal"): ` +
    `use the UNDERSTANDING line to note briefly what changed (e.g., "You want a shorter version."), ` +
    `then provide the refined response after ---.\n` +
    `5. For Japanese requests, provide natural Japanese after ---. For bilingual requests, provide both languages after ---.\n` +
    `6. Never publish, overwrite, or decide the final response. All decisions belong to the moderator.`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.7,
    max_tokens: 800,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  const result = (response.choices[0]?.message?.content ?? '').trim();
  return result || null;
}

/**
 * Classifies a question against a list of moderator-defined categories.
 * Returns the matching category ID, or null if uncertain or no categories exist.
 * content and context are never modified — this only produces a category_id.
 * context is optional: when provided it enriches classification accuracy.
 */
export async function classifyQuestion(
  content: string,
  categories: CategoryOption[],
  context?: string | null
): Promise<string | null> {
  if (!categories.length || !process.env.OPENAI_API_KEY) return null;

  const categoryList = categories
    .map(c => `${c.id}: ${c.label}${c.label_ja ? ` / ${c.label_ja}` : ''}`)
    .join('\n');

  const questionBlock = context?.trim()
    ? `Question: ${content}\nContext: ${context.trim()}`
    : `Question: ${content}`;

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    max_tokens: 100,
    messages: [
      {
        role: 'system',
        content:
          'You are a conference question categorizer. ' +
          'Given a conference question (and optional context explaining why it is being asked) ' +
          'and a list of categories, return the ID of the single best-matching category. ' +
          'If no category clearly fits, or you are uncertain, return exactly: null. ' +
          'Respond with ONLY the category ID (a UUID) or the word null. No explanation, no punctuation.',
      },
      {
        role: 'user',
        content: `Categories:\n${categoryList}\n\n${questionBlock}`,
      },
    ],
  });

  const answer = (response.choices[0]?.message?.content ?? '').trim();
  if (!answer || answer === 'null') return null;

  // Validate: only return if it exactly matches one of our provided IDs
  const validIds = new Set(categories.map(c => c.id));
  return validIds.has(answer) ? answer : null;
}
