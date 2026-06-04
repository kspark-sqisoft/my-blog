import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { Icon } from '../components/Icon';
import { SITE } from '../lib/site';

// 백엔드 RegisterDto 제약과 동일하게 맞춘다 (T-AUTH-009: password 8~72, name 1~50).
const schema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요.'),
  name: z
    .string()
    .min(1, '이름을 입력하세요.')
    .max(50, '이름은 50자 이하여야 합니다.'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .max(72, '비밀번호는 72자 이하여야 합니다.'),
});
type FormValues = z.infer<typeof schema>;

export function Register() {
  const navigate = useNavigate();
  const registerUser = useAuth((s) => s.register);
  const error = useAuth((s) => s.error);
  const [show, setShow] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    const ok = await registerUser(values.email, values.password, values.name);
    if (ok) navigate('/');
  });

  return (
    <div className="ab-auth">
      <div className="ab-auth-card">
        <span className="ab-brand-dot big" />
        <h1 className="ab-auth-title">회원가입</h1>
        <p className="ab-auth-sub">{SITE.title} 회원으로 가입합니다</p>

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
            <span>이름</span>
            <input
              aria-label="이름"
              type="text"
              className="ab-input"
              {...register('name')}
            />
            {errors.name && <p className="ab-error">{errors.name.message}</p>}
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
            회원가입
          </button>
        </form>

        <Link to="/login" className="ab-text-link center">
          이미 계정이 있으신가요? 로그인
        </Link>
      </div>
    </div>
  );
}
