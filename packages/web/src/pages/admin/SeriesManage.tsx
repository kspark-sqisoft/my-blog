import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../auth/useAuth';
import { useCreateSeries, useDeleteSeries } from '../../admin/useSeriesAdmin';
import { useSeriesList } from '../../series/useSeriesList';

// 시리즈 생성 폼 검증(ADR-0004: 웹 폼 인라인 zod). 서버 @MaxLength(120)와 정합.
const createSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '제목을 입력하세요')
    .max(120, '제목은 120자 이하여야 합니다'),
});
type CreateForm = z.infer<typeof createSchema>;

// 최대 100개 시리즈까지 한 화면에서 관리(MVP). 그 이상은 후속 페이지네이션.
const LIST_SIZE = 100;

// 작성자 시리즈 관리 (/admin/series, ADR-0029). AUTHOR 는 본인 시리즈만, ADMIN 은 전체.
// 권한은 서버(Actor)가 강제하며, 목록 표시는 클라이언트에서 역할/소유로 거른다.
export function SeriesManage() {
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const query = useSeriesList({ page: 1, pageSize: LIST_SIZE });
  const create = useCreateSeries();
  const remove = useDeleteSeries();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { title: '' },
  });

  const onCreate = handleSubmit(({ title }) => {
    create.mutate(
      { title },
      {
        onSuccess: (series) => {
          reset();
          navigate(`/admin/series/${series.id}/edit`);
        },
      },
    );
  });

  const all = query.data?.items ?? [];
  const items =
    user?.role === 'ADMIN'
      ? all
      : all.filter((s) => s.authorId === user?.id);

  return (
    <>
      <header className="ab-admin-bar">
        <h1>시리즈 관리</h1>
      </header>

      <form onSubmit={onCreate} className="ab-admin-create">
        <label className="ab-field">
          <span>새 시리즈 제목</span>
          <input
            aria-label="새 시리즈 제목"
            type="text"
            className="ab-input"
            {...register('title')}
          />
          {errors.title && <p className="ab-error">{errors.title.message}</p>}
        </label>
        <button
          type="submit"
          className="ab-btn"
          disabled={create.isPending}
        >
          시리즈 만들기
        </button>
      </form>

      <div className="ab-admin-body">
        {query.isPending && (
          <p role="status" className="ab-state">
            불러오는 중…
          </p>
        )}
        {query.isError && (
          <p role="alert" className="ab-state error">
            목록을 불러오지 못했습니다.
          </p>
        )}
        {query.data &&
          (items.length === 0 ? (
            <p className="ab-empty">아직 시리즈가 없습니다.</p>
          ) : (
            <ul className="ab-table">
              <li className="ab-tr ab-th">
                <span>제목</span>
                <span>글 수</span>
                <span />
              </li>
              {items.map((series) => (
                <li className="ab-tr" key={series.id}>
                  <Link to={`/admin/series/${series.id}/edit`}>
                    {series.title}
                  </Link>
                  <span>{series.postCount}편</span>
                  <div className="ab-row-actions">
                    <Link
                      to={`/admin/series/${series.id}/edit`}
                      className="ab-row-btn"
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      className="ab-row-btn danger"
                      onClick={() => remove.mutate(series.id)}
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </>
  );
}
