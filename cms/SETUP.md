# QA Portfolio CMS — Setup Guide

## Stack
| Layer | Tech |
|-------|------|
| Backend | FastAPI 0.111 · SQLAlchemy 2 · Alembic · SQLite |
| Frontend | React 18 · Vite 5 · TypeScript · Tailwind CSS 3 · shadcn/ui |
| Editor | TipTap 2 (headings, tables, code blocks, images, embeds, task lists…) |
| Auth | JWT access tokens (15 min) + Refresh tokens (7 days) + TOTP MFA |
| Charts | Recharts |

---

## Quick Start (local dev)

### 1 — Clone & configure

```bash
cd cms/backend
cp .env.example .env        # Edit values (SECRET_KEY, ADMIN_EMAIL, etc.)

cd ../frontend
cp .env.example .env        # Edit VITE_API_URL if needed
```

### 2 — Backend

```bash
cd cms/backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Seed database (admin user + sample data)
python seed.py

# Start server
uvicorn app.main:app --reload --port 8000
```

Open API docs: http://localhost:8000/docs

### 3 — Frontend

```bash
cd cms/frontend
npm install
npm run dev
```

Open CMS: http://localhost:5173

**Default credentials (from seed):**
- Email: `admin@example.com`
- Password: `Admin@1234!`

---

## Docker (production)

```bash
cd cms

# Copy and configure env files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# Build & start
docker-compose up -d --build

# Run seed inside container
docker-compose exec backend python seed.py
```

- Backend: http://localhost:8000
- Frontend: http://localhost:5173

---

## MFA Setup

1. Log in → **Settings → Security → Enable MFA**
2. Scan the QR code with Google Authenticator / Authy
3. Enter the 6-digit code to confirm
4. Next login will require the OTP after your password

---

## Database Migrations

```bash
# Create migration after changing models
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```

---

## Project Structure

```
cms/
├── backend/
│   ├── app/
│   │   ├── main.py              Entry point
│   │   ├── config.py            Settings (pydantic-settings)
│   │   ├── database.py          SQLAlchemy engine + session
│   │   ├── dependencies.py      FastAPI dependencies (auth)
│   │   ├── models/              SQLAlchemy ORM models
│   │   │   ├── user.py          User + RefreshToken
│   │   │   ├── post.py          Post (all fields + status enum)
│   │   │   ├── category.py      Category (nested)
│   │   │   ├── tag.py           Tag + M2M post_tags
│   │   │   ├── subscriber.py    Newsletter subscriber
│   │   │   ├── media.py         Uploaded file metadata
│   │   │   ├── settings.py      Key-value site settings
│   │   │   └── analytics.py     Analytics events
│   │   ├── schemas/             Pydantic v2 request/response models
│   │   ├── api/
│   │   │   ├── v1/              Admin API routes (JWT-protected)
│   │   │   │   ├── auth.py      Login, MFA, refresh, profile
│   │   │   │   ├── posts.py     CRUD + bulk status
│   │   │   │   ├── categories.py
│   │   │   │   ├── tags.py
│   │   │   │   ├── subscribers.py  + public subscribe/unsubscribe
│   │   │   │   ├── media.py     Upload + list + delete
│   │   │   │   ├── analytics.py Dashboard stats + event tracking
│   │   │   │   └── settings.py  Site settings CRUD
│   │   │   └── public/          Public read-only API (no auth)
│   │   │       ├── posts.py     List, single, recent, featured, related
│   │   │       ├── search.py    Full-text search
│   │   │       └── categories.py  + tags
│   │   └── core/
│   │       ├── security.py      JWT, TOTP, password hashing
│   │       ├── storage.py       Local file storage (swap for S3)
│   │       └── email.py         Email service (SMTP / disabled)
│   ├── alembic/                 Database migrations
│   ├── seed.py                  Sample data seeder
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx              Routes + auth guard
│   │   ├── store/auth.ts        Zustand auth store (persisted)
│   │   ├── lib/api.ts           Axios + auto-refresh interceptor
│   │   ├── components/
│   │   │   ├── layout/          AdminLayout, Sidebar, Header
│   │   │   ├── editor/          BlogEditor (TipTap) + EditorToolbar
│   │   │   ├── ui/              Button, Input, Badge, AlertDialog, etc.
│   │   │   └── shared/          StatCard, StatusBadge, ConfirmDialog
│   │   └── pages/
│   │       ├── auth/            LoginPage, MFAVerifyPage
│   │       ├── DashboardPage    Stats + charts + recent posts
│   │       ├── posts/           PostsPage (table) + PostEditorPage
│   │       ├── CategoriesPage
│   │       ├── TagsPage
│   │       ├── SubscribersPage  + CSV export
│   │       ├── MediaPage        Grid/list + drag-drop upload
│   │       └── SettingsPage     Site config + profile + MFA + password
│   ├── tailwind.config.ts       Design tokens matching portfolio
│   └── Dockerfile
└── docker-compose.yml
```

---

## Public API Endpoints (for Portfolio Integration)

All are **GET**, no authentication required.

| Endpoint | Description |
|----------|-------------|
| `GET /api/public/posts?page=1&page_size=10` | Paginated published posts |
| `GET /api/public/posts/recent?limit=5` | Recent posts |
| `GET /api/public/posts/featured?limit=3` | Featured posts |
| `GET /api/public/posts/{slug}` | Single post by slug |
| `GET /api/public/posts/{slug}/related` | Related posts |
| `GET /api/public/search?q=playwright&page=1` | Full-text search |
| `GET /api/public/categories` | All categories with post counts |
| `GET /api/public/categories/tags` | All tags with post counts |
| `POST /api/v1/subscribers/subscribe` | Subscribe form handler |
| `GET /api/v1/subscribers/confirm?token=…` | Email confirmation |
| `GET /api/v1/subscribers/unsubscribe?token=…` | One-click unsubscribe |
| `POST /api/v1/analytics/event` | Track page view / share |

---

## Integrating with Your Static Portfolio

### Option A — Client-side fetch (simplest)

Add to your portfolio's JavaScript:

```javascript
const CMS_URL = 'http://localhost:8000'  // your deployed backend URL

async function loadRecentPosts() {
  const res = await fetch(`${CMS_URL}/api/public/posts/recent?limit=3`)
  const posts = await res.json()
  // Render posts...
}
```

### Option B — Build-time (Next.js / Astro)

```typescript
// In your blog's data fetching
const CMS_API = process.env.CMS_API_URL || 'http://localhost:8000'

export async function getPublishedPosts(page = 1) {
  const res = await fetch(`${CMS_API}/api/public/posts?page=${page}&page_size=10`)
  return res.json()
}
```

### Subscribe widget

```html
<form id="subscribe-form">
  <input type="email" id="sub-email" placeholder="your@email.com" />
  <button type="submit">Subscribe</button>
</form>
<script>
document.getElementById('subscribe-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('sub-email').value
  await fetch('http://localhost:8000/api/v1/subscribers/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  })
  alert('Check your email to confirm!')
})
</script>
```

---

## Editor Features

The TipTap-powered editor supports:

| Feature | How |
|---------|-----|
| Headings H1–H4 | Toolbar buttons |
| Bold, Italic, Underline, Strike | Toolbar or Ctrl+B/I/U |
| Inline code | Toolbar or backtick shorthand |
| Code blocks with language | Click `</>` button → pick language |
| Tables | Insert 3×3, resize, add/remove rows/cols |
| Bullet / ordered / task lists | Toolbar |
| Blockquote | Toolbar |
| Links | Toolbar → enter URL |
| Images | Toolbar → enter image URL + alt text |
| YouTube embeds | Toolbar → enter YouTube URL |
| Text colour | Colour picker |
| Highlight | Toolbar |
| Text alignment | Left / center / right / justify |
| Horizontal rule | Toolbar |
| Autosave | Every 2s to localStorage |
| Preview mode | Toggle in editor top bar |
| Word / char count | Footer of editor |

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Key | Default | Description |
|-----|---------|-------------|
| `SECRET_KEY` | random | **Change in production** — used to sign JWTs |
| `DATABASE_URL` | sqlite:///./cms.db | SQLite path |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | 15 | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | 7 | Refresh token lifetime |
| `ADMIN_EMAIL` | admin@example.com | Seed admin email |
| `ADMIN_PASSWORD` | Admin@1234! | Seed admin password |
| `ALLOWED_ORIGINS` | localhost:5173 | Comma-separated CORS origins |
| `UPLOAD_DIR` | uploads | Directory for media files |
| `EMAILS_ENABLED` | false | Set to `true` + fill SMTP_ vars |
| `FRONTEND_URL` | http://localhost:5173 | Used in email links |

### Frontend (`frontend/.env`)

| Key | Default | Description |
|-----|---------|-------------|
| `VITE_API_URL` | http://localhost:8000 | Backend base URL |
| `VITE_APP_NAME` | QA Portfolio CMS | App title |
