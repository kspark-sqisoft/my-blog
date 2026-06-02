# ADR-0008: API 스타일로 REST 채택

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

프론트(web)와 백엔드(api) 간 통신 방식을 정해야 한다. 도메인은 Post/Comment/Tag/Auth로 단순하고 자원 중심이다. 스캐폴딩은 NestJS의 기본 HTTP 컨트롤러 구성을 갖추고 있고 GraphQL 관련 패키지는 설치되어 있지 않다. 프론트는 axios + TanStack Query로 HTTP/JSON 소비를 전제한다.

평가 기준: 도메인 적합성, 스캐폴딩 정합성, 구현·학습 비용.

## 결정 (Decision)

자원 중심 REST API(`/api` 경로, JSON)를 채택한다. GraphQL은 도입하지 않는다.

## 결과 (Consequences)

긍정:
- 단순한 자원 모델에 잘 맞고, NestJS 기본 구성과 axios/TanStack Query를 그대로 활용한다.
- 추가 의존성·러닝커브가 없다.

부정/감수해야 할 것:
- 복잡한 그래프형 조회나 과다·과소 페칭 최적화가 필요해지면 엔드포인트가 늘어난다.

## 검토 시점

클라이언트가 다양해지고 유연한 질의 요구(과다/과소 페칭 문제)가 커지면 GraphQL 도입을 재평가한다.
