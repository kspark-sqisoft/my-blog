import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import {
  useDeleteSeries,
  useSetSeriesPosts,
  useUpdateSeries,
} from '../../admin/useSeriesAdmin';
import { useAuth } from '../../auth/useAuth';
import { usePosts } from '../../posts/usePosts';
import { useSeries } from '../../series/useSeries';

// 시리즈 정보 폼 검증(ADR-0004: 웹 폼 인라인 zod). 서버 class-validator 와 정합.
const infoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목을 입력하세요')
    .max(120, '제목은 120자 이하여야 합니다'),
  description: z.string().max(500, '설명은 500자 이하여야 합니다'),
});

const AUTHOR_POSTS_SIZE = 100;

// 작성자 시리즈 편집 (/admin/series/:id/edit, ADR-0029).
// 제목·설명 수정(PATCH) + 멤버십·순서 재지정(PUT posts) + 삭제. 권한은 서버가 강제.
export function SeriesEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const seriesQuery = useSeries(id);
  // 본인 발행글을 시리즈 후보로 (작성자 필터, ADR-0028). ADMIN 도 본인 글 기준.
  const authorPosts = usePosts({ author: user?.id, pageSize: AUTHOR_POSTS_SIZE });
  const update = useUpdateSeries(id);
  const setPosts = useSetSeriesPosts(id);
  const remove = useDeleteSeries();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 시리즈 로드 시 1회 폼·순서 초기화 (렌더 중 가드 초기화 — PostEditor 패턴)
  if (seriesQuery.data && seriesQuery.data.id !== loadedId) {
    setLoadedId(seriesQuery.data.id);
    setTitle(seriesQuery.data.title);
    setDescription(seriesQuery.data.description ?? '');
    setOrderedIds(seriesQuery.data.posts.map((p) => p.id));
  }

  if (seriesQuery.isPending) {
    return (
      <p role="status" className="ab-state">
        불러오는 중…
      </p>
    );
  }
  if (seriesQuery.isError) {
    return (
      <p role="alert" className="ab-state error">
        시리즈를 찾을 수 없습니다.
      </p>
    );
  }

  // 제목 조회용 맵(포함된 글 + 후보 글)
  const titleById = new Map<string, string>();
  for (const p of seriesQuery.data.posts) titleById.set(p.id, p.title);
  for (const p of authorPosts.data?.items ?? []) titleById.set(p.id, p.title);

  // 후보는 본인 발행글만(user 미로드 시 타인 글 노출 방지) + 아직 미포함인 글.
  const candidates = (authorPosts.data?.items ?? []).filter(
    (p) => p.authorId === user?.id && !orderedIds.includes(p.id),
  );

  const onSaveInfo = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = infoSchema.safeParse({ title, description });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    update.mutate({
      title: parsed.data.title,
      description: parsed.data.description,
    });
  };

  const move = (index: number, delta: number) => {
    const next = [...orderedIds];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrderedIds(next);
  };

  return (
    <>
      <header className="ab-admin-bar">
        <h1>시리즈 편집</h1>
        <div className="ab-bar-actions">
          <Link to="/admin/series" className="ab-btn ghost">
            목록
          </Link>
          <button
            type="button"
            className="ab-btn danger"
            onClick={() =>
              remove.mutate(id, {
                onSuccess: () => navigate('/admin/series'),
              })
            }
          >
            시리즈 삭제
          </button>
        </div>
      </header>

      <form onSubmit={onSaveInfo} className="ab-admin-body">
        <label className="ab-field">
          <span>제목</span>
          <input
            aria-label="제목"
            type="text"
            className="ab-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
          />
        </label>
        <label className="ab-field">
          <span>설명</span>
          <textarea
            aria-label="설명"
            className="ab-input"
            rows={3}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
          />
        </label>
        {error && <p className="ab-error">{error}</p>}
        {update.isError && (
          <p role="alert" className="ab-error">
            저장에 실패했습니다.
          </p>
        )}
        <button type="submit" className="ab-btn" disabled={update.isPending}>
          정보 저장
        </button>
      </form>

      <section className="ab-admin-body">
        <h2 className="ab-section-title">글 구성</h2>

        {/* 포함된 글(순서) */}
        {orderedIds.length === 0 ? (
          <p className="ab-empty">아직 추가된 글이 없습니다.</p>
        ) : (
          <ol className="ab-series-order">
            {orderedIds.map((pid, index) => (
              <li key={pid} className="ab-tr">
                <span>{titleById.get(pid) ?? pid}</span>
                <div className="ab-row-actions">
                  <button
                    type="button"
                    className="ab-row-btn"
                    aria-label={`위로: ${titleById.get(pid) ?? pid}`}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="ab-row-btn"
                    aria-label={`아래로: ${titleById.get(pid) ?? pid}`}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="ab-row-btn danger"
                    onClick={() =>
                      setOrderedIds(orderedIds.filter((x) => x !== pid))
                    }
                  >
                    제거
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {/* 추가 가능한 발행글 */}
        {candidates.length > 0 && (
          <ul className="ab-series-candidates">
            {candidates.map((p) => (
              <li key={p.id} className="ab-tr">
                <span>{p.title}</span>
                <button
                  type="button"
                  className="ab-row-btn"
                  aria-label={`${p.title} 추가`}
                  onClick={() => setOrderedIds([...orderedIds, p.id])}
                >
                  추가
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          className="ab-btn"
          disabled={setPosts.isPending}
          onClick={() => setPosts.mutate({ postIds: orderedIds })}
        >
          순서 저장
        </button>
      </section>
    </>
  );
}
