# ADR-0004: 공유 타입은 순수 TS 계약으로 두고 검증은 각 패키지에서

## 상태 (Status)

Accepted - 2026-06-02

## 컨텍스트 (Context)

`packages/shared`를 프론트(web)와 백엔드(api)가 공유한다. 무엇을 공유할지 결정해야 한다. 스캐폴딩은 api에 `class-validator`/`class-transformer`를, web에 `zod`를 이미 설치해 두 패키지의 검증 도구가 다르다.

평가 기준: 단일 소스 여부, 도구 일관성, 스캐폴딩과의 정합성.

## 결정 (Decision)

`packages/shared`에는 DTO/응답 형태를 기술하는 **순수 TypeScript 타입(인터페이스)** 계약만 둔다. 런타임 검증은 api는 class-validator DTO로, web은 zod 스키마로 각자 구현한다.

## 결과 (Consequences)

긍정:
- 양쪽 패키지가 동일한 타입 계약을 참조해 형태 불일치를 컴파일 타임에 잡는다.
- 각 패키지가 이미 설치된 검증 도구를 그대로 사용해 추가 의존성이 없다.

부정/감수해야 할 것:
- 검증 규칙이 두 곳(class-validator, zod)에 중복 정의되어 동기화 부담이 있다.
- 규칙 변경 시 양쪽을 함께 수정해야 한다.

## 검토 시점

검증 규칙 중복으로 인한 불일치 버그가 반복되면 공유 zod 스키마(ADR로 supersede) 도입을 재평가한다.
