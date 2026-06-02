import { Link, useParams } from 'react-router-dom';
import { CommentSection } from '../components/CommentSection';
import { Markdown } from '../components/Markdown';
import { usePost } from '../posts/usePost';

export function PostDetail() {
  const { id = '' } = useParams();
  const query = usePost(id);

  if (query.isPending) {
    return (
      <p role="status" className="p-8 text-center text-gray-500">
        불러오는 중…
      </p>
    );
  }
  if (query.isError) {
    return (
      <p role="alert" className="p-8 text-center text-red-600">
        글을 불러오지 못했습니다.
      </p>
    );
  }

  const post = query.data;
  return (
    <article className="mx-auto max-w-3xl p-6 text-left">
      <h1 className="text-3xl font-semibold">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-500">
        {post.publishedAt ? post.publishedAt.slice(0, 10) : '미발행'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {post.tags.map((tag) => (
          <Link
            key={tag}
            to={`/tags/${tag}`}
            className="rounded bg-violet-100 px-2 py-0.5 text-xs text-violet-700"
          >
            #{tag}
          </Link>
        ))}
      </div>
      <div className="mt-6">
        <Markdown content={post.contentMarkdown} />
      </div>
      <CommentSection postId={post.id} />
    </article>
  );
}
