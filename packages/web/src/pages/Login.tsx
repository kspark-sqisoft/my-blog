import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';

const schema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
});
type FormValues = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const error = useAuth((s) => s.error);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    const ok = await login(values.email, values.password);
    if (ok) navigate('/admin');
  });

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm p-8 text-left">
      <h1 className="mb-6 text-2xl font-semibold">운영자 로그인</h1>

      <label className="mb-1 block" htmlFor="email">
        이메일
      </label>
      <input
        id="email"
        aria-label="이메일"
        type="email"
        className="mb-1 w-full rounded border px-3 py-2"
        {...register('email')}
      />
      {errors.email && (
        <p className="mb-2 text-sm text-red-600">{errors.email.message}</p>
      )}

      <label className="mt-3 mb-1 block" htmlFor="password">
        비밀번호
      </label>
      <input
        id="password"
        aria-label="비밀번호"
        type="password"
        className="mb-1 w-full rounded border px-3 py-2"
        {...register('password')}
      />
      {errors.password && (
        <p className="mb-2 text-sm text-red-600">{errors.password.message}</p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 w-full rounded bg-violet-600 px-4 py-2 text-white disabled:opacity-50"
      >
        로그인
      </button>
    </form>
  );
}
