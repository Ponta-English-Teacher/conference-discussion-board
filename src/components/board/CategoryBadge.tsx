import type { Category, Lang } from '@/types';
import { i18n } from '@/lib/i18n';

interface Props {
  category: Category | null | undefined;
  lang: Lang;
}

export default function CategoryBadge({ category, lang }: Props) {
  const t = i18n[lang].board;
  const label = category
    ? (lang === 'ja' && category.label_ja ? category.label_ja : category.label)
    : t.uncategorized;

  return (
    <span className="inline-block text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
      {label}
    </span>
  );
}
