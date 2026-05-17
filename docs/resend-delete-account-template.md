# Resend 삭제 확인 템플릿

이 템플릿은 `user.deleteUser.sendDeleteAccountVerification`에서 쓰는 Resend dashboard template용 문구다.

## 템플릿 계약

- Template name: `harune-account-deletion-email`
- Template alias: `harune-account-deletion-email`
- Subject: `Confirm your Harune account deletion`
- From: `Harune <noreply@harune.me>`
- Variables: `ACTION_URL`

## 본문

아래 HTML을 Resend 대시보드의 Template에 붙여 넣는다.

```html
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f6f5f2;padding:32px;font-family:Arial,Helvetica,sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;padding:32px;">
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.2;color:#111827;">Confirm your Harune account deletion</h1>
      <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
        Use the button below to permanently delete your Harune account. This action cannot be undone.
      </p>
      <p style="margin:0 0 24px;">
        <a
          href="{{{ACTION_URL}}}"
          style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700;"
        >
          Delete account
        </a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:#6b7280;">
        If the button does not work, copy and paste this link:<br />
        <span style="word-break:break-all;">{{{ACTION_URL}}}</span>
      </p>
    </div>
  </body>
</html>
```

## 메모

- 변수는 `ACTION_URL` 하나만 쓰면 된다.
- 버튼 링크는 `{{{ACTION_URL}}}` 로 채운다.
- 대시보드에서 Template을 publish한 뒤, `RESEND_DELETE_ACCOUNT_TEMPLATE_ID` 에 그 Template alias를 넣는다.
- Resend API는 published template의 `id` 또는 `alias`를 받으므로, 이 값은 alias로 사용해도 된다.
