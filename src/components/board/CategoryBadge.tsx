import type { Category, Lang } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  category: Category | null | undefined;
  lang: Lang;
}

// Full class strings must be static literals for Tailwind to include them at build time
const CATEGORY_COLORS = [
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-orange-100 text-orange-700 border-orange-200',
] as const;

function colorForId(id: string): string {
  const hash = id.split('').reduce((n, c) => n + c.charCodeAt(0), 0);
  return CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
}

export default function CategoryBadge({ category, lang }: Props) {
  const t = i18n[lang].board;

  if (!category) {
    return (
      <span className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border bg-slate-100 text-slate-400 border-slate-200 font-medium">
        {t.uncategorized}
      </span>
    );
  }

  const label = lang === 'ja' && category.label_ja ? category.label_ja : category.label;

  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border font-medium ${colorForId(category.id)}`}>
      {label}
    </span>
  );
}
