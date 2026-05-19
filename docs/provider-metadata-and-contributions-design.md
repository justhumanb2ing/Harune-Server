# Provider Metadata in `profile_link_bento`

## 결정

외부 링크의 provider 데이터는 별도 테이블로 쪼개지 않고 `profile_link_bento.metadata` `jsonb` 컬럼에 저장한다.
도메인은 검색/표시용으로 `profile_link_bento.domain` `text` 컬럼에도 함께 저장한다.

지금 요구는 다음과 같다.

- GitHub contribution 데이터는 최근 60일만 저장한다.
- refresh는 하지 않는다.
- provider별 UI 분기는 프론트엔드에서 처리한다.
- YouTube 채널 링크는 `channels.list`의 첫 번째 `items`만 저장한다.

이 조건이면 단일 JSONB 컬럼이 가장 단순하고 충분하다.

## 저장 형태

`profile_link_bento`는 아래처럼 쓴다.

- 기존 컬럼: `title`, `description`, `favicon`, `thumbnail`, `url`
- 추가 컬럼: `domain`, `metadata`

`metadata`에는 provider 공통 envelope를 넣는다.

```ts
type LinkBentoMetadata = {
  provider: string;
  viewType: string;
  fetchedAt: string;
  payload: Record<string, unknown>;
};
```

`/metadata` 응답도 같은 envelope를 쓴다. 실제 코드에서는 provider별로 아래 타입으로 좁혀진다.

```ts
type NormalizedMetadata = {
  // ...
  providerMetadata:
    | ProviderMetadata
    | GithubContributionMetadata
    | YoutubeChannelMetadata
    | null;
};

type YoutubeChannelMetadata = {
  provider: "youtube";
  viewType: "youtube_channel";
  fetchedAt: string;
  payload: {
    snippet: Record<string, unknown>;
    statistics: Record<string, unknown>;
  };
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
- `domain`은 정규화된 hostname을 담는 중복 컬럼이라, 필요하면 표시/필터링에서 먼저 사용하고 `metadata.domain`은 응답 호환성용으로 유지한다.

## YouTube 저장 규칙

YouTube 채널 링크가 들어오면 `/metadata`에서 YouTube Data API v3 `channels.list`를 호출한다.

요구사항은 다음과 같다.

- 채널 링크만 처리한다.
- `part=snippet,statistics`를 사용한다.
- 응답의 `items[0]`만 사용한다.
- 저장 payload에는 `snippet`과 `statistics`만 넣는다.
- YouTube API 키는 서버 env의 `YOUTUBE_API_KEY`를 사용한다.
- `/metadata` 응답의 `providerMetadata`는 `YoutubeChannelMetadata` 타입으로 내려간다.
- 즉, `provider`는 `"youtube"`, `viewType`은 `"youtube_channel"`로 고정된다.

권장 payload는 아래 정도면 충분하다.

```ts
{
  provider: "youtube",
  viewType: "youtube_channel",
  fetchedAt: "2026-05-12T00:00:00.000Z",
  payload: {
    snippet: {
      title: "YouTube Creators",
      description: "..."
    },
    statistics: {
      viewCount: 123456,
      subscriberCount: 7890,
      hiddenSubscriberCount: false,
      videoCount: 42
    }
  }
}
```

## Spotify 저장 규칙

Spotify 링크가 들어오면 `/metadata`에서 Spotify oEmbed를 우선 시도한다.

요구사항은 다음과 같다.

- 공식 문서상 `open.spotify.com`과 `spotify.link`의 대부분 페이지가 oEmbed를 지원한다.
- 서버는 페이지에서 `application/json+oembed` 링크를 찾을 수 있을 때만 oEmbed를 사용한다.
- oEmbed 링크가 없으면 generic HTML metadata 추출로 fallback한다.
- oEmbed 응답의 `title`과 `thumbnail_url`을 metadata에 반영한다.
- `providerMetadata`는 `provider: "spotify"`, `viewType: "spotify_oembed"` envelope로 내려간다.

권장 payload는 아래 정도면 충분하다.

```ts
{
  provider: "spotify",
  viewType: "spotify_oembed",
  fetchedAt: "2026-05-19T00:00:00.000Z",
  payload: {
    title: "My Path to Spotify: Women in Engineering",
    html: "<iframe src=\"https://open.spotify.com/embed/track/123\"></iframe>",
    width: 456,
    height: 152,
    version: "1.0",
    providerName: "Spotify",
    providerUrl: "https://spotify.com",
    type: "rich",
    thumbnailUrl: "https://i.scdn.co/image/ab67656300005f1ff8141e891abf749375772343",
    thumbnailWidth: 300,
    thumbnailHeight: 300
  }
}
```

## CHZZK 저장 규칙

CHZZK 채널 링크가 들어오면 `/metadata`에서 URL path를 채널 ID로 분석하고 CHZZK Open API `GET /open/v1/channels`를 호출한다.

요구사항은 다음과 같다.

- 지원 URL은 `https://chzzk.naver.com/{channelId}`, `https://chzzk.naver.com/live/{channelId}`, `https://m.chzzk.naver.com/{channelId}`이다.
- `video`, `clips`, `category` path는 채널 URL로 보지 않고 generic metadata 경로로 보낸다.
- 요청에는 `channelIds` query parameter를 사용한다.
- CHZZK Open API는 서버 env의 `CHZZK_CLIENT_ID`, `CHZZK_CLIENT_SECRET`을 `Client-Id`, `Client-Secret` 헤더로 사용한다.
- 응답의 `providerMetadata`는 `ChzzkChannelMetadata` 타입으로 내려간다.
- 즉, `provider`는 `"chzzk"`, `viewType`은 `"chzzk_channel"`로 고정된다.

권장 payload는 아래 정도면 충분하다.

```ts
{
  provider: "chzzk",
  viewType: "chzzk_channel",
  fetchedAt: "2026-05-19T00:00:00.000Z",
  payload: {
    channelId: "45e71a76e949e16a34764deb962f9d9f",
    channelName: "아야츠노 유니",
    channelImageUrl: "https://nng-phinf.pstatic.net/profile.jpg",
    followerCount: 123456,
    verifiedMark: true
  }
}
```

## 결론

현재 요구에서는 `profile_link_bento.metadata` JSONB를 유지하면서, 정규화된 hostname은 `profile_link_bento.domain` 컬럼에 별도로 저장하는 것이 맞다.
