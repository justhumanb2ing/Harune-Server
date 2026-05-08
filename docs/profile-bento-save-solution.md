# `/profile/me/bento` 저장 버그 솔루션

## 요약

문제의 핵심은 `GET`과 `PUT`이 같은 `id`를 쓰지 않았다는 점이다.

- 읽기 응답은 subtype row의 `id`를 노출했다.
- 저장 로직은 canonical parent row인 `profile_bento.id`를 기준으로 diff를 계산했다.
- 그래서 프론트가 `GET`에서 받은 `id`를 그대로 다시 보내면, 서버는 기존 아이템으로 인식하지 못하고 새 row로 취급했다.

결과적으로 다음 현상이 발생했다.

- 수정 저장 시 기존 아이템은 그대로 남고, 수정본이 새로 생성된다.
- 삭제 저장 시 기존 아이템이 삭제되지 않는다.
- 새로고침하면 예전 값과 새 값이 동시에 보인다.

이 버그는 `PUT`/`PATCH` 선택 문제가 아니라, **읽기 계약과 쓰기 계약의 id 기준이 달랐던 문제**다.

---

## 재현 흐름

초기 상태:

- `profile_bento.id = "bento-2"`
- `profile_text_bento.id = "text-row-1"`

`GET /profile/{handle}` 응답은 다음처럼 `text-row-1`을 `id`로 내려준다.

```json
{
  "bento": [
    {
      "id": "text-row-1",
      "type": "text",
      "content": {
        "content": "1"
      }
    }
  ]
}
```

프론트는 이 `id`를 유지한 채 저장 payload를 보낸다.

```json
{
  "bento": [
    {
      "id": "text-row-1",
      "type": "text",
      "content": {
        "content": "122"
      }
    }
  ]
}
```

그런데 저장 로직은 `profile_bento.id` 기준으로 비교한다.

```ts
// before
existing = existingById.get(incoming.id) // incoming.id = "text-row-1"
// existingById keys are "bento-2", "bento-1"
// => existing is undefined

if (!existing) {
  insertProfileBento(incoming.id)
}
```

그래서 서버는 `"text-row-1"`을 새 bento로 보고 insert한다.
기존 `"bento-2"`는 삭제 대상으로 잡히지 않으면 그대로 남는다.

---

## 원인

문제는 두 겹이었다.

1. 읽기 응답이 public snapshot용 `id`를 반환했다.
2. 저장 로직이 canonical parent `id`만 비교했다.

즉, 서버 안에서 같은 아이템을 두 개의 서로 다른 식별자로 해석하고 있었다.

### 잘못된 흐름

```ts
// read
return {
  id: subtypeRow.id, // 예: "text-row-1"
  type: "text",
  content: { content: "1" },
};

// write
const existing = existingById.get(incoming.id); // 기존 키는 "bento-2"
if (!existing) {
  // 새 row로 취급
  insert(incoming.id);
}
```

이 구조에서는 수정/삭제/재저장이 모두 어긋난다.

---

## 해결

저장 경로에서 incoming `id`를 기존 DB 스냅샷의 canonical `profile_bento.id`로 되돌렸다.

### 핵심 아이디어

```ts
const publicIdToCanonicalId = new Map<string, string>();

for (const row of existingRows) {
  const publicId = buildProfileBentoSnapshot(row).id;
  publicIdToCanonicalId.set(publicId, row.bentoId);
}

const normalizedIncomingBentos = bentos.map((bento) => ({
  ...bento,
  id: publicIdToCanonicalId.get(bento.id) ?? bento.id,
}));
```

이렇게 하면:

- `text-row-1` 같은 GET 응답 ID는 `bento-2`로 매핑된다.
- 새로 만든 draft bento는 매핑이 없으면 그대로 새 ID로 처리된다.
- delete/update/no-op 비교가 모두 canonical 기준으로 맞춰진다.

### 저장 비교 흐름

```ts
const existingBentos = buildProfileBentosFromRows(existingRows, "canonical");
const incomingBentos = normalizeIncomingIds(existingRows, bentos);

if (signature(existingBentos) === signature(incomingBentos)) {
  return; // 진짜 no-op
}

for (const bento of incomingBentos) {
  const existing = existingById.get(bento.id);

  if (!existing) {
    insertParentRow(bento.id);
    insertSubtypeRow(bento.id);
    continue;
  }

  if (existing.type !== bento.type) {
    deleteOldSubtypeAndParent(existing.id);
    insertParentRow(bento.id);
    insertSubtypeRow(bento.id);
    continue;
  }

  upsertParentRow(bento.id);
  upsertSubtypeRow(bento.id);
}
```

---

## 코드 기준 변경점

### 1. snapshot id를 public / canonical로 나눔

`src/repositories/profile-repository.ts`

```ts
type ProfileBentoIdMode = "public" | "canonical";

function getProfileBentoSnapshotId(row, idMode) {
  if (idMode === "canonical") {
    return row.bentoId;
  }

  switch (row.bentoType) {
    case "text":
      return row.textBentoId;
    case "media":
      return row.mediaBentoId;
    // ...
  }
}
```

### 2. 저장 전에 public id를 canonical id로 변환

```ts
const normalizedIncomingBentos = bentos.map((bento) => ({
  ...bento,
  id: publicIdToCanonicalId.get(bento.id) ?? bento.id,
}));
```

### 3. 비교와 upsert/delete는 canonical id만 사용

```ts
const existingById = new Map(existingBentos.map((bento) => [bento.id, bento]));
const incomingById = new Map(normalizedIncomingBentos.map((bento) => [bento.id, bento]));
```

이제 저장은 `profile_bento.id` 기준으로만 이뤄진다.

---

## 테스트

회귀 테스트는 두 가지를 고정했다.

1. public snapshot `id`를 canonical id로 매핑해서 update 되는지
2. public snapshot `id`를 canonical id로 매핑해서 delete 되는지

예시 테스트:

```ts
await syncProfileBentoGraph(db as never, "page-1", [
  {
    id: "text-row-1", // GET 응답에서 온 public id
    type: "text",
    layout: { ... },
    content: { content: "Updated text" },
  },
]);

expect(getInsertValues(operations, "profile_bento")).toEqual([
  {
    id: "bento-2", // canonical parent id로 저장돼야 한다
    profilePageId: "page-1",
    type: "text",
    updatedAt: expect.any(Date),
  },
]);
```

이 테스트가 의미하는 바는 분명하다.

- `text-row-1`이 그대로 저장되면 실패해야 한다.
- `bento-2`로 저장돼야 정상이다.

---

## 결론

이번 장애의 원인은 `PUT` 자체가 아니라 **read contract와 write contract가 다른 id를 사용한 것**이다.

해결은 저장 시점에 public snapshot id를 canonical id로 환원하는 것이다.

이렇게 하면 기존 아이템 수정, 삭제, 신규 생성이 모두 같은 저장 경로에서 일관되게 처리된다.
