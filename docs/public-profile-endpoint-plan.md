# 공개 프로필 조회 엔드포인트 계획

## 목표

`GET /profile/:handle` 프로필 조회 엔드포인트를 만든다.

응답은 아래 DTO를 기준으로 한다.

```ts
type GetProfileRequest = {
  handle: string;
};

type ProfileResponse = {
  page: {
    id: string;
    userId: string;
    handle: string;
    name: string | null;
    role: string | null;
    bio: string | null;
    image: string | null;
    backgroundImage: string | null;
    location: string | null;
    updatedAt: string;
  };
  bento: ProfileBentoItem[];
  viewer: {
    isAuthenticated: boolean;
    userId: string | null;
    canEdit: boolean;
  };
};
```

## 현재 코드 기준

- 라우트 엔트리는 `src/routes/profile-route.ts` 이다.
- 앱에서는 이미 `src/routes/profile-route.ts` 를 `/profile` prefix로 마운트하고 있으므로 실제 엔드포인트는 `GET /profile/:handle` 이다.
- 세션은 `src/middlewares/session-middleware.ts` 에서 한 번 가져오고 있다.
- Better Auth 는 `src/lib/auth.ts` 에서 `experimental: { joins: true }` 로 이미 켜져 있다.
- 프로필 관련 테이블은 `src/schemas/profile.ts` 에 정의되어 있다.

## 프로젝트에 맞는 설계

### 1. route는 얇게 유지한다

`src/routes/profile-route.ts` 는 다음만 담당한다.

- `handle` 파라미터 검증
- 서비스 호출
- 성공 시 JSON 응답 반환
- 실패 시 공통 에러 포맷으로 변환

실제 조인과 DTO 변환은 route 밖으로 뺀다.

### 2. repository/service를 분리한다

추천 구조는 아래처럼 나눈다.

- `src/repositories/profile-repository.ts`
  - DB join query 실행
  - raw row 반환
- `src/services/get-profile.ts`
  - repository 결과를 `ProfileResponse` 로 정규화
  - viewer 계산
  - handle not found, invalid shape 같은 도메인 에러 정리

이렇게 나누면 route 파일이 커지지 않고, 이후 editor/public parity 작업도 재사용하기 쉽다.

### 3. 조인 전략

공개 프로필 응답은 사실상 아래 조합이다.

- `profile_page`
- `profile_bento`
- `profile_bento_layout`
- `profile_link_bento`
- `profile_text_bento`
- `profile_playlist_bento`
- `profile_section_bento`
- `profile_media_bento`
- `profile_map_bento`

추천은 단일 조회에서 `leftJoin` 중심으로 최대한 모으는 것이다.

#### page 조회

- `profile_page.handle = :handle` 로 단건 조회
- `updatedAt` 은 ISO 문자열로 직렬화한다

#### bento 조회

- `profile_bento.profilePageId = profile_page.id` 로 조인한다
- `profile_bento_layout` 은 `breakpoint = desktop / compact` 둘 다 반드시 존재해야 한다
- subtype 테이블은 `type` 에 맞춰 `leftJoin` 한다
- 각 bento 는 `type` 별로 1개의 subtype row만 기대한다

#### Better Auth experimental join 활용

- `auth.api.getSession()` 경로는 Better Auth join 활성화의 직접 수혜를 받는다
- 현재는 `sessionMiddleware` 가 전체 요청에서 세션을 읽고 있으므로, 공개 프로필 응답의 `viewer` 계산은 별도 세션 재조회 없이 `c.get("session")` 값을 재사용하는 쪽이 좋다
- 즉, join 은 auth session lookup 비용을 줄이는 용도로 쓰고, 프로필 본문 데이터는 Drizzle join query 로 한 번에 읽는 구성이 가장 자연스럽다

### 4. 응답 매핑 규칙

#### page

- `name`, `role`, `bio`, `location`, `image`, `backgroundImage` 는 DB nullable 값을 그대로 반영한다
- `updatedAt` 은 ISO 문자열로 변환한다

#### bento

각 type 별 매핑 규칙을 고정한다.

- `link`
  - `title`, `description`, `favicon`, `thumbnail`, `url`
- `text`
  - `content`
- `playlist`
  - `title`, `provider`, `url`, `content`
- `section`
  - `title`
- `media`
  - `mediaType`, `url`, `objectKey`, `href`, `alt`, `caption`
- `map`
  - `latitude`, `longitude`, `zoom`, `caption`, `url`

layout 은 아래처럼 유지한다.

- `desktop`
- `compact`

둘 다 `x`, `y`, `w`, `h` 를 가진다.

#### viewer

- `isAuthenticated`
  - session 이 있으면 `true`, 없으면 `false`
- `userId`
  - session 이 있으면 `session.userId`
  - 없으면 `null`
- `canEdit`
  - authenticated 이고 `viewer.userId === page.userId` 일 때만 `true`

## 구현 순서

1. `src/routes/profile-route.ts` 에서 `:handle` 검증과 서비스 호출 뼈대를 만든다.
2. `src/repositories/profile-repository.ts` 를 추가해서 profile page + bento + layout + subtype 을 읽는 join query 를 만든다.
3. `src/services/get-profile.ts` 를 추가해서 raw row 를 `ProfileResponse` 로 변환한다.
4. `viewer` 계산은 현재 `sessionMiddleware` 가 제공하는 `user` / `session` 을 재사용하도록 맞춘다.
5. `handle not found` 는 `404` 로 통일하고, 내부 조회 실패는 공통 에러 포맷을 사용한다.
6. response shape 를 type-safe 하게 고정하고, `updatedAt` 같은 날짜 필드는 ISO string 으로 직렬화한다.

## 검증 포인트

- `handle` 이 없는 요청은 validation error 로 떨어져야 한다
- 존재하지 않는 handle 은 `404` 여야 한다
- 로그인한 사용자가 본인 프로필을 조회하면 `viewer.canEdit = true`
- 비로그인 사용자는 `viewer.isAuthenticated = false`, `userId = null`, `canEdit = false`
- bento type 별 payload 가 DTO 와 정확히 일치해야 한다
- layout 이 하나라도 누락되면 내부 데이터 불일치로 실패해야 한다

## 아직 정해야 할 것

- bento 정렬 기준
  - 현재 구현에서는 의미 있는 요구가 없으므로 안정적인 기본 순서만 유지하면 된다
  - 이후 렌더 우선순위가 생기면 별도 컬럼으로 승격하는 편이 낫다
- `linkBlockPosition` 은 제거한다
  - 레거시 값이므로 이번 응답 계약에 포함하지 않는다

## 권장 결론

이 엔드포인트는 `route -> service -> repository` 3단으로 분리하고, profile 본문은 Drizzle join 으로 한 번에 읽는다.

Better Auth experimental join 은 세션 조회 비용을 줄이는 용도로 유지하고, `viewer` 계산은 이미 존재하는 `sessionMiddleware` 결과를 재사용하는 방식이 가장 적다.

layout 누락은 허용하지 않고, 데이터 불일치로 빠르게 실패시킨다.
