# ADR-0011: Docker Compose를 베이스 + dev/prod 오버라이드로 분리하고 멀티스테이지 빌드 채택

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

pnpm workspace 모노레포(api: NestJS, web: React/Vite, db: PostgreSQL)를 컨테이너로 실행해야 한다. 개발 환경은 빠른 피드백(소스 변경 시 핫리로드)이 필요하고, 운영 환경은 작고 안전한 산출물 전용 이미지가 필요하다. 또한 api는 DB가 연결 가능한 상태가 된 뒤에 시작해야 마이그레이션·기동 실패를 피한다.

평가 기준: dev/prod 요구의 차이(핫리로드 vs 산출물), 설정 중복 최소화, 기동 순서 보장.

## 결정 (Decision)

Compose를 3파일로 분리한다.
- `docker-compose.yml` (베이스): 공통 서비스(db/api/web), DB `pg_isready` healthcheck, api의 `depends_on: db: condition: service_healthy`.
- `docker-compose.dev.yml`: dev 타깃 + 소스 볼륨 마운트(NestJS `start:dev`, Vite `--host`), 파일 감시 폴링.
- `docker-compose.prod.yml`: prod 타깃 + 빌드 산출물만(볼륨 마운트 없음), api는 외부 미노출하고 web(nginx)이 `/api` 프록시.

api/web Dockerfile은 멀티스테이지(`dev` / `build` / `prod`)로 구성하고, 운영 이미지는 컴파일 산출물과 운영 의존성만 포함한다.

## 결과 (Consequences)

긍정:
- 공통 설정은 베이스 한 곳에만 두어 중복이 없다.
- dev는 소스 마운트로 핫리로드, prod는 산출물만 담아 이미지가 작고 공격 표면이 작다.
- healthcheck 게이트로 api가 DB 준비 후 시작해 기동 경합을 막는다.
- nginx same-origin 프록시로 httpOnly 쿠키(ADR-0001) 운용이 단순해진다.

부정/감수해야 할 것:
- 두 개의 `-f` 플래그를 항상 지정해야 하는 실행 관례가 생긴다.
- Windows 바인드 마운트에서 핫리로드를 위해 폴링이 필요해 약간의 CPU 비용이 든다.
- 운영 의존성 설치를 워크스페이스 전체로 수행해 이미지에 약간의 여유 용량이 남는다(추후 최적화 여지).

## 검토 시점

Kubernetes 등 오케스트레이터로 배포가 이동하거나, 이미지 용량·빌드 시간이 문제가 되면 빌드 전략(예: pnpm deploy, 멀티아키)과 배포 매니페스트를 재평가한다.
