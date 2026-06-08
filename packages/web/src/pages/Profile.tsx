import { zodResolver } from '@hookform/resolvers/zod';
import { type ChangeEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../auth/useAuth';
import { Avatar } from '../components/Avatar';
import { Icon } from '../components/Icon';
import { useUpdateProfile, useUploadAvatar } from '../profile/useProfile';

// 프로필 폼 검증(ADR-0025·ADR-0004: 웹 폼은 zod). avatarUrl 은 업로드가 채운 로컬 /uploads 경로 또는 null.
const profileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '이름을 입력하세요')
    .max(50, '이름은 50자 이하여야 합니다'),
  avatarUrl: z
    .string()
    .regex(/^\/uploads\//, '아바타 경로가 올바르지 않습니다')
    .nullable(),
  // 소개: 0~200자(빈 문자열 = 소개 제거). 서버 @MaxLength(200)와 정합 (ADR-0028)
  bio: z.string().max(200, '소개는 200자 이하여야 합니다'),
});
type ProfileForm = z.infer<typeof profileSchema>;

const BIO_MAX = 200;

export function Profile() {
  const user = useAuth((s) => s.user);
  const upload = useUploadAvatar();
  const update = useUpdateProfile();
  const [saved, setSaved] = useState(false);
  // 아바타 미리보기는 로컬 state(제출값은 RHF avatarUrl 필드가 보유). react-hook-form watch 미사용.
  const [preview, setPreview] = useState<string | null>(user?.avatarUrl ?? null);

  // 소개 글자 수 표시(서버 제한과 정합). register onChange 로 갱신(watch 미사용).
  // 주의: 프로그램적으로 setValue('bio', ...) 를 추가하면 setBioLength 도 함께 호출할 것.
  const [bioLength, setBioLength] = useState(user?.bio?.length ?? 0);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      avatarUrl: user?.avatarUrl ?? null,
      bio: user?.bio ?? '',
    },
  });

  // ProtectedRoute 하위라 정상적으로는 user 가 항상 있다(방어적 처리).
  if (!user) return null;

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일 재선택 허용
    if (!file) return;
    upload.mutate(file, {
      onSuccess: (result) => {
        setValue('avatarUrl', result.url, { shouldValidate: true });
        setPreview(result.url);
        setSaved(false);
      },
    });
  };

  const removeAvatar = () => {
    setValue('avatarUrl', null, { shouldValidate: true });
    setPreview(null);
    setSaved(false);
  };

  const onSubmit = handleSubmit((values) => {
    update.mutate(values, { onSuccess: () => setSaved(true) });
  });

  return (
    <div className="ab-page">
      <Link to="/" className="ab-back">
        <Icon name="back" size={16} /> 글 목록
      </Link>
      <h1 className="ab-article-title">프로필</h1>

      <form onSubmit={onSubmit} className="ab-auth-form mt-4 max-w-md">
        <div className="flex items-center gap-4">
          <Avatar src={preview} name={user.name} size="lg" />
          <div className="flex flex-col gap-2">
            <label className="ab-btn ghost cursor-pointer">
              {upload.isPending ? '업로드 중…' : '이미지 변경'}
              <input
                type="file"
                aria-label="아바타 이미지 선택"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="hidden"
                onChange={onPickFile}
              />
            </label>
            {preview && (
              <button
                type="button"
                className="ab-text-link"
                onClick={removeAvatar}
              >
                아바타 제거
              </button>
            )}
          </div>
        </div>
        {upload.isError && (
          <p role="alert" className="ab-error">
            아바타 업로드에 실패했습니다(이미지·2MB 이하).
          </p>
        )}

        <label className="ab-field">
          <span>이메일</span>
          <input
            aria-label="이메일"
            type="email"
            className="ab-input"
            value={user.email}
            readOnly
            disabled
          />
        </label>

        <label className="ab-field">
          <span>이름</span>
          <input
            aria-label="이름"
            type="text"
            className="ab-input"
            {...register('name', { onChange: () => setSaved(false) })}
          />
          {errors.name && <p className="ab-error">{errors.name.message}</p>}
        </label>

        <label className="ab-field">
          <span>소개</span>
          <textarea
            aria-label="소개"
            className="ab-input"
            rows={3}
            maxLength={BIO_MAX}
            {...register('bio', {
              onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
                setSaved(false);
                setBioLength(e.target.value.length);
              },
            })}
          />
          <span className="ab-hint">
            {bioLength}/{BIO_MAX}
          </span>
          {errors.bio && <p className="ab-error">{errors.bio.message}</p>}
        </label>

        {update.isError && (
          <p role="alert" className="ab-error">
            저장에 실패했습니다. 잠시 후 다시 시도하세요.
          </p>
        )}
        {saved && <p className="ab-ok">저장되었습니다.</p>}

        <button
          type="submit"
          disabled={isSubmitting || upload.isPending}
          className="ab-btn block"
        >
          저장
        </button>
      </form>
    </div>
  );
}
