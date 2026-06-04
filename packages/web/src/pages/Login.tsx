import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { Icon } from '../components/Icon';
import { SITE } from '../lib/site';

const schema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
});
type FormValues = z.infer<typeof schema>;

export function Login() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const error = useAuth((s) => s.error);
  const [show, setShow] = useState(false);
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
    <div className="ab-auth">
      <div className="ab-auth-card">
        <span className="ab-brand-dot big" />
        <h1 className="ab-auth-title">운영자 로그인</h1>
        <p className="ab-auth-sub">{SITE.title} 관리 콘솔에 접속합니다</p>

        <form onSubmit={onSubmit} className="ab-auth-form">
          <label className="ab-field">
            <span>이메일</span>
            <input
              aria-label="이메일"
              type="email"
              className="ab-input"
              {...register('email')}
            />
            {errors.email && <p className="ab-error">{errors.email.message}</p>}
          </label>

          <label className="ab-field">
            <span>비밀번호</span>
            <div className="ab-input-wrap">
              <input
                aria-label="비밀번호"
                type={show ? 'text' : 'password'}
                className="ab-input"
                {...register('password')}
              />
              <button
                type="button"
                className="ab-input-icon"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? '비밀번호 숨기기' : '비밀번호 표시'}
              >
                <Icon name={show ? 'eyeoff' : 'eye'} size={16} />
              </button>
            </div>
            {errors.password && (
              <p className="ab-error">{errors.password.message}</p>
            )}
          </label>

          {error && (
            <p role="alert" className="ab-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={isSubmitting} className="ab-btn block">
            로그인
          </button>
        </form>

        <Link to="/" className="ab-text-link center">
          블로그로 돌아가기
        </Link>
      </div>
    </div>
  );
}
