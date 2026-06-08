import type { PostDetailDto } from '@blog/shared';
import { AxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { useToggleLike } from '../posts/useEngagement';
import { Icon } from './Icon';

// 좋아요 버튼 (ADR-0024). 로그인 필요. 확정 비로그인(unauthenticated)이면 클릭 즉시
// /login 으로 안내한다. 부팅 직후 idle/loading 상태는 쿠키 세션 사용자가 있을 수 있어
// 단정하지 않고 API 호출 → 401 분기를 그대로 거친다(토큰 만료·미인증 케이스 백업).
// 호버 시 title 로 "로그인 후 좋아요" 를 미리 노출해 사용자가 클릭 전 의도를 안다.
export function LikeButton({ post }: { post: PostDetailDto }) {
  const navigate = useNavigate();
  const status = useAuth((s) => s.status);
  const toggle = useToggleLike(post.id, post.slug);
  const knownAnon = status === 'unauthenticated';
  const ariaLabel = post.likedByMe ? '좋아요 취소' : '좋아요';
  const title = knownAnon ? '로그인 후 좋아요를 누를 수 있습니다' : ariaLabel;

  const onClick = () => {
    if (knownAnon) {
      navigate('/login');
      return;
    }
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
      aria-label={ariaLabel}
      title={title}
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
