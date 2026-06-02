import { describe, expect, it } from 'vitest';
import { api } from './api';

describe('api 클라이언트', () => {
  it('baseURL=/api, withCredentials=true 로 설정된다', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.withCredentials).toBe(true);
  });
});
