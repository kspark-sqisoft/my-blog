// 미니멀 스트로크 아이콘 (애플 시안 기준). name 으로 경로를 선택한다.
const PATHS: Record<string, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" />
    </>
  ),
  moon: <path d="M20 14.2A8 8 0 0 1 9.8 4 7.5 7.5 0 1 0 20 14.2Z" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  back: <path d="M19 12H5M11 18l-6-6 6-6" />,
  reply: <path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l3 3" />,
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  eyeoff: (
    <path d="M4 4l16 16M9.5 5.8A8 8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.7 3.3M6 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5a8 8 0 0 0 3-.6" />
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.2" />
      <circle cx="8.5" cy="10" r="1.6" />
      <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  logout: <path d="M15 5h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3M10 12h10M16 8l4 4-4 4" />,
  grid: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  // 에디터 툴바 아이콘 (T-WEB-307)
  undo: <path d="M9 7 4 11.5l5 4.5M4 11.5h9.5a5.5 5.5 0 0 1 0 11H8" />,
  redo: <path d="M15 7l5 4.5-5 4.5M20 11.5h-9.5a5.5 5.5 0 0 0 0 11H16" />,
  'list-bullet': (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" />
      <circle cx="4.5" cy="12" r="1" />
      <circle cx="4.5" cy="18" r="1" />
    </>
  ),
  'list-ordered': (
    <path d="M10 6h10M10 12h10M10 18h10M4 4.5h1.5V9M4 9h3M4.2 14.5h2.3v1.6L4.2 18.5h2.6" />
  ),
  quote: (
    <path d="M7 7H4.5v4H7l-1.5 4M16 7h-2.5v4H16l-1.5 4" />
  ),
  codeblock: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M9 9.5 7 12l2 2.5M15 9.5l2 2.5-2 2.5" />
    </>
  ),
  link: (
    <path d="M10 13a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 11a4.5 4.5 0 0 0-6.4 0l-2.1 2.1a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2" />
  ),
  rule: <path d="M4 12h16" />,
  highlight: (
    <>
      <path d="M4 20.5h5M5 17l-1 3.5 3.5-1 9.5-9.5-2.5-2.5L5 17Z" />
      <path d="M13 7l4 4" />
    </>
  ),
  'align-left': <path d="M4 6h16M4 10.5h10M4 15h16M4 19.5h10" />,
  'align-center': <path d="M4 6h16M7 10.5h10M4 15h16M7 19.5h10" />,
  'align-right': <path d="M4 6h16M10 10.5h10M4 15h16M10 19.5h10" />,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
