'use client';

import type { Category, Lang } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  categories: Category[];
  selected: string | null; // null = All
  lang: Lang;
  onChange: (categoryId: string | null) => void;
}

export default function CategoryFilter({ categories, selected, lang, onChange }: Props) {
  const t = i18n[lang].board;

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange(null)}
        className={`text-sm px-3 py-1 rounded-full border transition-colors ${
          selected === null
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
        }`}
      >
        {t.filterAll}
      </button>

      <button
        onClick={() => onChange('uncategorized')}
        className={`text-sm px-3 py-1 rounded-full border transition-colors ${
          selected === 'uncategorized'
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
        }`}
      >
        {t.uncategorized}
      </button>

      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onChange(cat.id)}
          className={`text-sm px-3 py-1 rounded-full border transition-colors ${
            selected === cat.id
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
          }`}
        >
          {lang === 'ja' && cat.label_ja ? cat.label_ja : cat.label}
        </button>
      ))}
    </div>
  );
}
