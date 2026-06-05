import type { PostDetailDto } from '@blog/shared';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useToggleLike } from '../posts/useEngagement';
import { Icon } from './Icon';

// 좋아요 버튼 (ADR-0024). 로그인 필요 — 비로그인이 누르면 서버가 401 →
// 로그인 페이지로 유도한다(공개 페이지라 클라 인증상태는 신뢰하지 않음).
export function LikeButton({ post }: { post: PostDetailDto }) {
  const navigate = useNavigate();
  const toggle = useToggleLike(post.id, post.slug);

  const onClick = () => {
    toggle.mutate(post.likedByMe, {
      onError: (err) => {
        if (err instanceof AxiosError && err.response?.status === 401) {
          navigate('/login');
        }
      },
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={toggle.isPending}
      aria-pressed={post.likedByMe}
      aria-label={post.likedByMe ? '좋아요 취소' : '좋아요'}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm transition disabled:opacity-60' +
        (post.likedByMe
          ? ' border-rose-300 text-rose-600 [&_svg]:fill-current'
          : ' border-gray-300 text-gray-600 hover:border-rose-300 hover:text-rose-600')
      }
    >
      <Icon name="heart" size={18} />
      <span>{post.likeCount}</span>
    </button>
  );
}
