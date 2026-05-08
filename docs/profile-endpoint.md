# Profile API

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
