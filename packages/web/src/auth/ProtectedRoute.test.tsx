import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api', () => ({ api: { post: vi.fn(), get: vi.fn() } }));

import { api } from '../lib/api';
import { useAuth } from './useAuth';
import { ProtectedRoute } from './ProtectedRoute';

const mockedApi = api as unknown as {
  post: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
};

function renderProtected() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <div>SECRET</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuth.setState({ user: null, status: 'idle', error: null });
    vi.clearAllMocks();
  });

  it('미인증(me 실패) 시 /login 으로 리다이렉트한다', async () => {
    mockedApi.get.mockRejectedValueOnce(new Error('401'));
    renderProtected();
    expect(await screen.findByText('LOGIN PAGE')).toBeInTheDocument();
  });

  it('인증됨(me 성공) 시 children 을 렌더한다', async () => {
    mockedApi.get.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'owner@example.com' } },
    });
    renderProtected();
    expect(await screen.findByText('SECRET')).toBeInTheDocument();
  });
});
