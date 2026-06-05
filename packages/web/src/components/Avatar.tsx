// 아바타 (ADR-0025): src 있으면 이미지, 없으면 이름 첫 글자 이니셜 원형 폴백. 인라인 style 금지(Tailwind).
const SIZES = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-9 h-9 text-sm',
  lg: 'w-24 h-24 text-3xl',
} as const;

export function Avatar({
  src,
  name,
  size = 'md',
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof SIZES;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? '아바타'}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} inline-flex shrink-0 items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-200`}
    >
      {initial}
    </span>
  );
}
