# DodoPayments 구독 플랜 설계

## 목적

이 문서는 DodoPayments 월 구독 상품을 앱의 플랜/권한 모델에 연결하는 최종 설계 기준이다.

전제는 다음과 같다.

- DodoPayments에는 월 구독 상품만 존재한다.
- DodoPayments는 결제와 구독 상태의 외부 원장이다.
- 앱의 권한 판단 기준은 로컬 DB의 `app_user.planId`와 `plans.quotas`다.
- `plans`는 Dodo 상품 카탈로그가 아니라, 앱 내부 플랜 정책 원장이다.

현재 코드 기준으로 `plans.monthlyDodoProductId`는 존재하지만, `src/lib/auth.ts`에서는 아직 Dodo productId를 하드코딩하고 있다.

## 현재 스키마

### `app_user`

`src/schemas/base.ts`

- `dodoCustomerId`
- `dodoSubscriptionId`
- `planId`

이 컬럼들은 구독 사용자와 앱 내부 플랜을 연결하기 위한 최소 매핑 값이다.

### `plans`

`src/schemas/plan.ts`

- `monthlyDodoProductId`
- `quotas`
- `default`
- `codename`

월 구독만 쓰는 동안에는 `monthlyDodoProductId`만 실제 매핑 대상으로 사용하면 된다.

### `profile_page`

`src/schemas/profile.ts`

- `userId`에 unique index가 있다.
- 따라서 현재 구조는 유저당 페이지 1개다.

플랜별 다중 페이지를 허용하려면 이 제약을 나중에 바꿔야 한다.

## 최종 구조

### 1. Dodo 상품

- Dodo 대시보드에서 월 구독 상품을 만든다.
- 생성된 `product_id`를 로컬 `plans.monthlyDodoProductId`에 1회 매핑한다.
- 입력 방식은 수동 SQL, seed, migration, admin 화면 중 무엇이든 가능하다.

중요한 점은 Dodo 상품 생성 자체는 필요하지만, **반드시 DB에 손으로 직접 넣어야 하는 것은 아니다**. 다만 로컬 DB 어딘가에는 반드시 매핑이 존재해야 한다.

### 2. 플랜 정책

`plans`는 다음 역할을 한다.

- Dodo product와 내부 플랜의 매핑
- 플랜 이름과 코드명 보관
- 기본 플랜 식별
- 기능 제한 정책 보관

즉, 런타임 권한 판단은 Dodo가 아니라 로컬 `plans`를 기준으로 해야 한다.

### 3. 사용자 상태

`app_user`는 다음 역할을 한다.

- 어떤 Dodo 고객인지 식별
- 어떤 Dodo 구독이 연결되어 있는지 식별
- 어떤 내부 플랜을 적용받는지 식별

즉, `app_user.planId`가 실제 앱 권한의 기준이다.

## 웹훅 처리 규칙

웹훅은 구독 상태를 로컬 DB에 반영하는 용도다.

### 사용해야 할 핸들러

- `onSubscriptionActive`
- `onSubscriptionRenewed`
- `onSubscriptionPlanChanged`
- `onSubscriptionCancelled`
- `onSubscriptionExpired`
- `onSubscriptionFailed`
- `onSubscriptionOnHold`

### `onPayload`

`onPayload`는 공통 로깅/디버깅용으로만 둔다.

- 모든 웹훅 이벤트에 대해 먼저 호출된다.
- 비즈니스 권한 갱신은 여기서 하지 않는다.
- 실제 상태 반영은 `onSubscription*` 핸들러에 둔다.

### 상태 반영 규칙

- `onSubscriptionActive`
  - `data.customer.customer_id`로 유저를 찾는다.
  - `data.product_id`로 `plans.monthlyDodoProductId`를 찾는다.
  - 매칭된 `plan.id`를 `app_user.planId`에 저장한다.
  - `data.subscription_id`를 `app_user.dodoSubscriptionId`에 저장한다.

- `onSubscriptionRenewed`
  - 갱신을 반영한다.
  - 필요 시 `dodoSubscriptionId`와 플랜 상태를 재확인한다.

- `onSubscriptionPlanChanged`
  - 변경된 `data.product_id`를 기준으로 plan을 다시 매핑한다.

- `onSubscriptionCancelled`
- `onSubscriptionExpired`
- `onSubscriptionFailed`
- `onSubscriptionOnHold`
  - 권한 회수 또는 하위 플랜 전환을 처리한다.
  - 실제 정책은 앱 요구사항에 따라 free 플랜, 제한 플랜, 또는 inactive 상태로 정한다.

## quotas 설계

핸들 변경과 페이지 생성 같은 기능 제한은 `quotas`로 정의한다.

권장 형태는 다음과 같다.

```ts
type Quotas = {
  features: {
    customHandleChange: boolean;
  };
  limits: {
    handleChangesPerMonth: number | null;
    maxProfilePages: number | null;
  };
};
```

### 의미

- `boolean`
  - 기능 on/off
- `number`
  - 제한값
- `null`
  - 무제한

### 예시

```ts
const freePlanQuotas = {
  features: {
    customHandleChange: true,
  },
  limits: {
    handleChangesPerMonth: 1,
    maxProfilePages: 1,
  },
};

const proPlanQuotas = {
  features: {
    customHandleChange: true,
  },
  limits: {
    handleChangesPerMonth: 5,
    maxProfilePages: 3,
  },
};

const premiumPlanQuotas = {
  features: {
    customHandleChange: true,
  },
  limits: {
    handleChangesPerMonth: null,
    maxProfilePages: null,
  },
};
```

## 사용량 저장

`quotas`는 정책이고, 실제 사용량은 별도 저장이 필요하다.

### 핸들 변경

- 월 단위 사용량을 누적해야 한다.
- `handleChangesPerMonth`와 비교해서 제한한다.
- 총 누적 횟수보다 월간 횟수가 적합하다.

### 페이지 생성

- 현재는 `profile_page.userId`가 unique이므로 유저당 1개 페이지 구조다.
- 다중 페이지를 플랜별로 허용하려면 스키마 변경이 필요하다.
- 그 전까지는 `maxProfilePages`를 1로 두는 것이 맞다.

### 권장 추가 테이블

- `handle_change_events`
  - `userId`
  - `changedAt`
  - `fromHandle`
  - `toHandle`
- 또는 월간 카운터 테이블
  - `userId`
  - `monthKey`
  - `changeCount`

## 서버 강제 지점

권한 제한은 UI가 아니라 서버에서 강제해야 한다.

### 핸들 변경 API

- 현재 플랜의 `handleChangesPerMonth` 확인
- 이번 달 변경 횟수 확인
- 초과 시 거부

### 페이지 생성 API

- 현재 유저가 가진 페이지 수 확인
- `maxProfilePages`와 비교
- 초과 시 거부

### UI

- `GET /me` 응답의 `currentPlan.quotas`는 화면 제어에만 사용
- 실제 보안은 서버에서 막아야 한다

## Dodo List Products API에 대한 판단

Dodo의 List Products API는 다음 용도에는 쓸 수 있다.

- 관리자 화면에서 상품 목록 보여주기
- `plans.monthlyDodoProductId`를 고를 후보로 사용하기
- seed 또는 초기 동기화 보조로 사용하기

하지만 `plans` 자체를 대체할 수는 없다.

이유:

- `quotas`는 Dodo 상품에 없다.
- `default` 플랜은 앱 개념이다.
- `codename`도 앱 개념이다.
- 런타임 권한 판단을 외부 API에 직접 의존하면 지연과 장애에 취약하다.

결론적으로 Dodo List Products API는 **보조 데이터 소스**이고, `plans`는 **앱 권한 원장**으로 유지해야 한다.

## 구현 순서

1. Dodo 대시보드에서 월 구독 상품을 만든다.
2. 해당 `product_id`를 `plans.monthlyDodoProductId`에 매핑한다.
3. `plans.quotas`를 핸들 변경 / 페이지 생성 기준으로 재정의한다.
4. 웹훅에서 `onSubscriptionActive`, `onSubscriptionRenewed`, `onSubscriptionPlanChanged`, `onSubscriptionCancelled`, `onSubscriptionExpired`, `onSubscriptionFailed`, `onSubscriptionOnHold`를 구현한다.
5. `app_user.planId`, `app_user.dodoCustomerId`, `app_user.dodoSubscriptionId`를 상태 원장으로 사용한다.
6. 핸들 변경과 페이지 생성 route/service에서 quota 검증을 강제한다.
7. 다중 페이지가 필요해지면 `profile_page.userId` unique 제약을 재설계한다.

## 최종 결론

- Dodo 상품 생성은 필요하다.
- 로컬 DB에는 Dodo product와 플랜의 매핑이 반드시 있어야 한다.
- 그 입력은 수동 SQL일 수도 있고, seed나 migration일 수도 있다.
- 웹훅은 구독 상태를 로컬 DB에 반영하는 용도다.
- 권한 판단은 `app_user.planId` + `plans.quotas`로 한다.
- `quotas`는 기능 on/off와 제한값을 분리해서 표현해야 한다.
- 핸들 변경 횟수는 월간 카운터로, 페이지 생성은 보유 개수로 검사한다.
- Dodo List Products API는 `plans` 대체용이 아니라 관리/동기화 보조용이다.
