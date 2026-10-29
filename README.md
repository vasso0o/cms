# Pagecraft CMS frontend

An Angular static-site-generated content editor. The generated site contains the frontend only; authentication, invitations, page storage, and persistence are provided by your backend.

## Development

```bash
npm install
npm start
```

The Angular dev server starts at `http://localhost:4200`. API requests under `/api` are proxied to `http://localhost:4001` by [proxy.conf.json](./proxy.conf.json). Change that target to your backend address. Until a backend is connected, sign-in, invitation, and page-save requests will report that the API is unavailable.

## Static build

```bash
npm run build
```

The build prerenders the frontend into `dist/cms/browser`. Deploy that directory to any static host. No Node SSR server or database is included in this project.

## Backend API contract

The Angular app calls same-origin `/api` endpoints and expects JSON responses. Use cookie-based or another compatible authentication approach in your backend; if using cookies, configure the frontend and API on the same origin (or configure credentials and CORS as appropriate).

### Authentication

- `GET /api/auth/me` — current user: `{ "id": "...", "email": "...", "role": "admin" | "editor" }`; return `401` when signed out.
- `POST /api/auth/login` — body `{ "email": "...", "password": "..." }`; returns the current user.
- `POST /api/auth/logout` — ends the current session.
- `POST /api/auth/register` — body `{ "email": "...", "password": "...", "inviteToken": "..." }`; returns the new user.
- `POST /api/auth/invitations` — admin-only body `{ "email": "..." }`; returns `{ "email": "...", "token": "...", "expiresAt": "..." }`.

The UI expects invitation-based registration and uses the returned token to build a shareable invitation link. Enforce invitation expiry and one-time use in the backend.

### Pages

A page response has this shape:

```json
{
  "id": "page-id",
  "title": "About",
  "slug": "about",
  "status": "draft",
  "blocks": [
    {
      "id": "block-id",
      "type": "heading",
      "order": 0,
      "data": { "eyebrow": "", "text": "About us", "body": "Page content" }
    }
  ],
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

- `GET /api/pages` — pages visible to the signed-in user.
- `POST /api/pages` — create from `{ "title": "...", "status": "draft" | "published", "blocks": [] }`.
- `GET /api/pages/:id` — read a page.
- `PUT /api/pages/:id` — update title, status, and blocks. Each block carries a zero-based `order`; store it and return blocks sorted by it. Dragging a block in the editor saves the page immediately.
- `DELETE /api/pages/:id` — delete a page.

The available block types are `hero`, `heading`, `image`, `button`, and `faq`; each block's `data` contains its editable string fields. Scope page access to the authenticated user in your backend. Published status is currently metadata only; public page routes are not included yet.
