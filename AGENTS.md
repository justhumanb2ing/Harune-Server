## Working agreements

- 코드를 생성/수정/삭제한다면 문서나 API 계약도 동기화한다.
- API 계약을 생성/수정/삭제한다면 코드와 테스트도 동기화한다.
- 문서와 계약은 코드보다 먼저 작성한다. (코드가 문서를 따라오도록 한다.)
- 문서와 계약은 항상 최신 상태로 유지한다.

## API 문서 작성 규칙

### 계약 문서화

- `hono-docs.ts`와 `scripts/patch-openapi.ts`를 함께 본다.
- API 문서는 반드시 OpenAPI 스펙을 준수한다.
- Scalar 화면에 보이는 내용도 OpenAPI 스펙을 기준으로 생성되어야 한다.
- 엔드포인트를 생성/수정/삭제할 때는 OpenAPI와 Scalar 문서를 반드시 함께 갱신한다.
- 문서는 단순한 소개문이 아니라 프론트엔드가 스키마를 자동 생성해 쓰는 계약이므로, OpenAPI 규격을 엄격히 지킨다.
- 가능한 경우 응답은 `default`로 묶지 말고 상태코드별로 분리한다.
- 에러는 `default`보다 실제 상태코드(`400`, `401`, `403`, `404`, `500`, `502`)를 우선하여 분리한다.
- 각 상태코드는 무엇이 잘못됐는지 바로 드러나야 한다.
- `summary`는 한 줄로 기능을 요약한다.
- `description`은 아래를 포함한다.
  - 요청이 어떤 규칙으로 정규화되는지
  - 어떤 값이 validation error 인지
  - 인증이 필요한지
  - 어떤 조건에서 200/400/401/403/404/500/502가 나오는지
  - 현재 사용자 예외가 있는지
  - 다른 사용자 소유인지, 자기 소유인지, 미사용인지의 차이
- query/path/header/body 중 하나라도 존재하면 반드시 문서에 빠짐없이 적는다.
- body가 있으면 `requestBody`를, query/path가 있으면 해당 `parameters`를 반드시 적는다.
- body와 parameters를 생략하면 안 되며, 누락된 계약은 문서 완성으로 보지 않는다.
- 성공 응답은 반드시 `200`으로 정의한다.
- validation 계열은 가능한 한 `400`으로 분리한다.
- 세션/인증 누락은 `401`로 분리한다.
- not found, upstream failure, internal failure도 별도 상태코드로 둔다.
- 각 응답에 다음을 넣는다.
  - `description`
  - JSON `schema`
  - 가능한 경우 `examples`
- 예시는 응답의 필수 필드를 빠뜨리지 말고, 중첩 객체의 `required` 필드까지 포함해 실제 사용자가 그대로 따라갈 수 있게 작성한다.
- Scalar에서 “없어 보이는” 응답은 실제 schema와 example을 다시 대조해서 확인한다.

### Scalar/OpenAPI 후처리

- `scripts/patch-openapi.ts`는 생성된 OpenAPI를 사람이 읽기 좋은 계약으로 다듬는 자리다.
- 여기서 하는 수정도 OpenAPI 스펙을 벗어나면 안 된다.
- 여기서 다음을 한다.
  - mutation endpoint의 `requestBody` 추가/교체
  - `default` 응답 제거
  - 상태코드별 응답 추가/교체
- 예시 추가
- 파라미터 설명 보강
- 문구 정리
- 상태코드별 예시는 해당 상태코드의 핵심 응답 필드를 모두 보여주도록 작성한다.
- body가 필요한 mutation인데 `requestBody`가 없으면, Scalar에서 바로 쓸 수 없는 계약으로 본다.
- query/path/body 누락은 문서 결함으로 취급하고, 생성 후 `bun run docs:generate`로 반드시 확인한다.
- 생성 스크립트를 수정한 뒤에는 반드시 `bun run docs:generate`로 결과를 다시 만든다.

## 라우트 작성 규칙

- route 파일에는 얇은 진입점만 둔다.
- 검증, 인증, 저장소 조회, 응답 분기는 라우트에서 바로 끝내도 되지만, 중복되는 DB 조회는 repository로 뺀다.
- helper를 과하게 쪼개지 말고, 진짜 재사용이 필요할 때만 분리한다.
- 클라이언트가 생략할 수 있는 값이라도 서버는 정상 처리해야 한다.

## 테스트 규칙

- 새 API를 추가하거나 계약을 바꾸면 테스트를 추가 또는 갱신한다.
- 최소한 아래를 확인한다.
  - 성공 케이스
  - 인증 실패
  - validation 실패
  - reserved/format 실패
  - 자기 소유와 타인 소유의 차이
- 테스트는 `@cloudflare/vitest-pool-workers`를 설치해서 사용한다.
- 테스트 파일은 테스트하려는 파일과 같은 디렉터리 레벨에 `__test__` 폴더를 만들고 그 안에 둔다.
- 테스트 파일 이름은 대상 파일과 대응되게 짓는다.
- 문서 변경이 있으면 `bun run docs:generate`까지 확인한다.
- 타입 변경이 있으면 `bunx tsc --noEmit`까지 확인한다.

## 검증 범위 규칙

- `bun x biome check .`처럼 저장소 전체를 무차별 검사하지 않는다.
- Biome 검사는 항상 이번 작업에서 실제로 바뀐 tracked 파일만 대상으로 한다.
- 권장 방식은 `git diff --name-only --diff-filter=ACM -- '*.ts' '*.json' '*.jsonc'`로 대상 파일을 뽑아서 검사하는 것이다.
- `.wrangler/`, `node_modules/`, `dist/`, `src/generated/openapi.json` 같은 생성 산출물과 임시 빌드 파일은 저장소 전체 검사에서 잡음이 되기 쉽다. 이들은 필요할 때만 명시적으로 대상으로 삼는다.
- `docs:generate`를 돌렸다면 `src/generated/openapi.json`과 그에 연결된 contract test만 다시 확인하고, 그 외 파일은 건드리지 않는다.
- 생성 스크립트 또는 계약을 바꾼 뒤에는 `docs:generate -> targeted biome -> focused test -> tsc` 순서로 확인한다.
- 형식 오류가 많아 보일 때는 먼저 `git status --short`와 `git diff --name-only --diff-filter=ACM`로 실제 수정 범위를 확인한 뒤 검사한다.

## 문서 품질 체크리스트

- 설명이 “무엇을 한다” 수준에서 끝나지 않는가
- 어떤 입력이 거부되는지 분명한가
- 어떤 상태코드가 실제로 나가는지 적혀 있는가
- 예시가 있는가
- `default`를 남기지 않아도 되는 계약인데 남겨두지 않았는가
- Scalar에서 읽었을 때 API를 바로 쓸 수 있는가
