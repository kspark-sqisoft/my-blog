import axios from 'axios';

// API 클라이언트. baseURL=/api (Vite 프록시/ nginx가 백엔드로 전달),
// withCredentials=true 로 httpOnly access_token 쿠키를 동봉한다 (ADR-0001).
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});
