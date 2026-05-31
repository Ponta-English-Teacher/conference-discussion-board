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
}

export interface Participant {
  id: string;
  name: string;
  affiliation: string;
  session_id: string; // which session this participant joined
}

// content is immutable after creation — category_id and parent_id are the only mutable fields
export interface Question {
  id: string;
  session_id: string;
  category_id: string | null; // null = Uncategorized
  parent_id: string | null;
  content: string;            // never overwritten after insert
  author_name: string;
  author_affiliation: string;
  created_at: string;
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
