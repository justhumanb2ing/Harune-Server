# Profile API

## `GET /profile/pages`

Returns every row from the `profile_page` table.

This endpoint is read-only and does not require authentication.

### Response

```ts
type ProfilePagesResponse = {
  pages: {
    id: string;
    userId: string;
    handle: string;
    name: string | null;
    location: string | null;
    role: string | null;
    bio: string | null;
    image: string | null;
    backgroundImage: string | null;
    linkBlockPosition: number;
    createdAt: string;
    updatedAt: string;
  }[];
};
```

### Response Rules

- The rows are returned in `updatedAt` descending order, then `createdAt` descending order.
- `createdAt` and `updatedAt` are serialized as ISO-8601 strings.
- The response includes every stored column from `profile_page`.
- Successful responses should be returned with `Cache-Control: no-store`.

### Error Responses

#### `500 Internal Server Error`

Returned when the profile page list cannot be loaded.

```json
{
  "error": {
    "code": "profile_pages_failed",
    "message": "failed to load profile pages"
  }
}
```

## `GET /profile/:handle`

Returns the profile page, bento blocks, and viewer state for the requested handle.

This is a read-only endpoint. It does not require authentication, but if a session is present the response includes viewer ownership state.

### Path Parameters

- `handle`: profile handle.
- The route forwards the value directly to the lookup layer.
- The route does not apply additional handle-format validation.

### Response

```ts
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

### Response Rules

- `page.updatedAt` is serialized as an ISO-8601 string.
- Every bento item contains both `desktop` and `compact` layout entries.
- If any required layout row is missing, the request fails with a 500 error.
- `viewer.canEdit` is `true` only when the current session user owns the page.
- `viewer.isAuthenticated` is based on whether a session exists.
- `viewer.userId` is `null` when there is no session.

### Bento Shapes

- `link`
  - `content.title`
  - `content.description`
  - `content.favicon`
  - `content.thumbnail`
  - `content.url`
- `text`
  - `content.content`
- `section`
  - `content.title`
- `media`
  - `content.mediaType`
  - `content.url`
  - `content.objectKey`
  - `content.href`
  - `content.alt`
  - `content.caption`
- `map`
  - `content.latitude`
  - `content.longitude`
  - `content.zoom`
  - `content.caption`
  - `content.url`

### Error Responses

#### `404 Not Found`

Returned when no profile page exists for the requested handle.

```json
{
  "error": {
    "code": "profile_not_found",
    "message": "profile not found"
  }
}
```

#### `500 Internal Server Error`

Returned when profile data is internally inconsistent, for example if a required bento layout row is missing.

```json
{
  "error": {
    "code": "profile_layout_missing",
    "message": "profile bento <id> is missing required layouts"
  }
}
```

### Notes

- `layout` is required for every bento item.
- `viewer.canEdit` is `true` only when the authenticated session user owns the profile page.
- The endpoint is safe to call anonymously.
- The profile body is assembled from database joins rather than from a separate metadata cache.

## `PUT /profile/me/bento`

Replaces the authenticated user's bento graph with the provided snapshot.

### Save Performance Contract

- The response is returned after validation, required media promotion, and the database graph write complete.
- The response body is assembled from the accepted payload after the write, not from an additional public profile re-read.
- `preview:` bento media uploads may already live at a public preview object key. In that case the save accepts the public preview key in `tempObjectKey` and avoids a temp-to-final R2 copy.
- Legacy temp media keys are still accepted. They are copied to the final object key before the DB write, then temp deletion is deferred as best-effort cleanup after the response.
- Failed deferred temp deletion is logged but does not fail the completed save.
