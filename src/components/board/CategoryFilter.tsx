'use client';

import type { Category, Lang } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  categories: Category[];
  selected: string | null;
  lang: Lang;
  onChange: (categoryId: string | null) => void;
}

export default function CategoryFilter({ categories, selected, lang, onChange }: Props) {
  const t = i18n[lang].board;

  const pill = (active: boolean) =>
    active
      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
      : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50';

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => onChange(null)}
        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${pill(selected === null)}`}
      >
        {t.filterAll}
      </button>

      <button
        onClick={() => onChange('uncategorized')}
        className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${pill(selected === 'uncategorized')}`}
      >
        {t.uncategorized}
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`text-xs px-3.5 py-1.5 rounded-full border font-medium transition-colors ${pill(selected === cat.id)}`}
        >
          {lang === 'ja' && cat.label_ja ? cat.label_ja : cat.label}
        </button>
      ))}
    </div>
  );
}
