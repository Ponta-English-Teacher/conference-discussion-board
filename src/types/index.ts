export type Lang = 'en' | 'ja';

export interface Session {
  id: string;
  title: string;
  title_ja: string | null;
  is_active: boolean;
  created_at: string;
  question_count?: number; // populated by GET /api/sessions
}

export interface Category {
  id: string;
  session_id: string;
  label: string;
  label_ja: string | null;
  representative_question_id: string | null;
  discussion_trigger_question_id: string | null;
}

export interface Participant {
  id: string;
  name: string;
  affiliation: string;
  session_id: string; // which session this participant joined
  email: string | null;
  notify_on_response: boolean;
}

// content and context are immutable after creation — category_id and parent_id are the only mutable fields
export interface Question {
  id: string;
  session_id: string;
  category_id: string | null; // null = Uncategorized
  parent_id: string | null;
  content: string;            // immutable original in submission language
  context: string | null;     // immutable original in submission language
  content_en: string | null;  // English version: original if submitted in EN, AI translation if submitted in JA
  content_ja: string | null;  // Japanese version: original if submitted in JA, AI translation if submitted in EN
  context_en: string | null;  // English context version
  context_ja: string | null;  // Japanese context version
  author_name: string;
  author_affiliation: string;
  created_at: string;
  notify_on_response: boolean;
  vote_count: number;
  voted_by_me?: boolean;
  category?: Category | null;
  parent?: Pick<Question, 'id' | 'content' | 'author_name'> | null;
}

export interface Vote {
  id: string;
  question_id: string;
  voter_id: string;
}

export interface Response {
  id: string;
  question_id: string;
  author_name: string;
  author_affiliation: string;
  content: string;            // immutable original in submission language
  content_en: string | null;
  content_ja: string | null;
  created_at: string;
  email_sent: boolean;
  email_sent_at: string | null;
}

export interface ModeratorProfile {
  display_name: string;
  affiliation: string;
  email_signature: string;
}
