import type { UserRole } from '@blog/shared';
import { AxiosError } from 'axios';
import { useAdminUsers, useUpdateUserRole } from '../../admin/useAdminUsers';
import { fmtDate } from '../../lib/format';

const ROLES: UserRole[] = ['ADMIN', 'AUTHOR', 'MEMBER'];

export function UserManagement() {
  const query = useAdminUsers();
  const updateRole = useUpdateUserRole();

  const users = query.data?.items ?? [];

  // 409 면 마지막 ADMIN 보호, 그 외는 일반 실패로 구분한다.
  const status =
    updateRole.error instanceof AxiosError
      ? updateRole.error.response?.status
      : undefined;
  const errorMsg = updateRole.isError
    ? status === 409
      ? '마지막 관리자(ADMIN)는 다른 역할로 변경할 수 없습니다.'
      : '역할 변경에 실패했습니다.'
    : null;

  return (
    <>
      <header className="ab-admin-bar">
        <h1>사용자 관리</h1>
      </header>
      <div className="ab-admin-body">
        {errorMsg && (
          <p role="alert" className="ab-state error">
            {errorMsg}
          </p>
        )}
        {query.isPending ? (
          <p role="status" className="ab-state">
            불러오는 중…
          </p>
        ) : query.isError ? (
          <p role="alert" className="ab-state error">
            사용자 목록을 불러오지 못했습니다.
          </p>
        ) : (
          <ul className="ab-table">
            <li className="ab-tr ab-th">
              <span>이름</span>
              <span>이메일</span>
              <span>역할</span>
              <span>가입일</span>
            </li>
            {users.map((user) => (
              <li className="ab-tr" key={user.id}>
                <span className="ab-td-title">{user.name}</span>
                <span>{user.email}</span>
                <span>
                  <select
                    aria-label={`${user.name} 역할 변경`}
                    className="ab-input"
                    value={user.role}
                    onChange={(e) =>
                      updateRole.mutate({
                        id: user.id,
                        role: e.target.value as UserRole,
                      })
                    }
                  >
                    {ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </span>
                <span className="ab-td-date">{fmtDate(user.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
        {query.isSuccess && users.length === 0 && (
          <p className="ab-empty">사용자가 없습니다.</p>
        )}
      </div>
    </>
  );
}
