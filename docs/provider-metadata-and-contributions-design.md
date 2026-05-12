# Provider Metadata in `profile_link_bento`

## 결정

외부 링크의 provider 데이터는 별도 테이블로 쪼개지 않고 `profile_link_bento.metadata` `jsonb` 컬럼 하나에 저장한다.

지금 요구는 다음과 같다.

- GitHub contribution 데이터는 최근 60일만 저장한다.
- refresh는 하지 않는다.
- provider별 UI 분기는 프론트엔드에서 처리한다.

이 조건이면 단일 JSONB 컬럼이 가장 단순하고 충분하다.

## 저장 형태

`profile_link_bento`는 아래처럼 쓴다.

- 기존 컬럼: `title`, `description`, `favicon`, `thumbnail`, `url`
- 추가 컬럼: `metadata`

`metadata`에는 provider 공통 envelope를 넣는다.

```ts
type LinkBentoMetadata = {
  provider: string;
  viewType: string;
  fetchedAt: string;
  payload: Record<string, unknown>;
};
```

## GitHub 저장 규칙

GitHub 링크가 들어오면 `/metadata`에서 GitHub GraphQL API를 호출하고, 최근 60일 contribution calendar를 만든다.

권장 payload는 아래 정도면 충분하다.

```ts
{
  provider: "github",
  viewType: "github_contributions_60d",
  fetchedAt: "2026-05-12T00:00:00.000Z",
  payload: {
    login: "octocat",
    name: "The Octocat",
    avatarUrl: "https://...",
    profileUrl: "https://github.com/octocat",
    rangeStart: "2026-04-12",
    rangeEnd: "2026-05-12",
    totalContributions: 123,
    days: [
      {
        date: "2026-05-12",
        contributionCount: 4,
        contributionLevel: "FIRST_QUARTILE",
        color: "#39d353",
        weekday: 1
      }
    ]
  }
}
```

## 왜 이 정도면 충분한가

- 저장이 단순하다.
- 프론트가 `provider`와 `viewType`으로 바로 분기할 수 있다.
- provider가 늘어나도 `metadata` 스키마만 확장하면 된다.
- 지금은 refresh가 없으므로 history/snapshot/materialized row가 불필요하다.

## 주의점

- `metadata`가 커지면 조회 필터링이나 집계는 불편해진다.
- 나중에 provider별 집계나 search가 생기면 별도 테이블로 분리하는 편이 낫다.
- GitHub GraphQL은 토큰이 필요하므로 서버 env에 `GITHUB_TOKEN`이 있어야 한다.

## 결론

현재 요구에서는 `profile_link_bento.metadata` JSONB 한 칸으로 시작하고, GitHub contribution payload만 60일 기준으로 저장하는 것이 맞다.
