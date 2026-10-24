# TR Fastenings Multimedia

A media management platform for uploading, organizing, and viewing documents, images, and videos. Files are stored in AWS S3, sessions group uploads, and the viewer renders content by MIME type.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4 |
| Language | TypeScript 5 |
| ORM | Prisma 7 |
| Database | PostgreSQL 16 |
| File Storage | AWS S3 (ap-south-1) |
| DB Driver | pg (node-postgres) |
| Dev DB | Docker Compose |

---

## Features

- **Multi-file upload** — Drag-and-drop or browse; supports PDF, images (JPG, PNG, GIF), and videos (MP4, MOV)
- **Upload progress tracking** — XHR-based progress bar per upload batch
- **Session management** — Each upload batch is grouped into a session with status tracking (UPLOADING → COMPLETED / FAILED)
- **Document grid** — Browse documents in a selected session with MIME-type icons
- **Multi-screen layout** — Assign documents to numbered screens; add screens dynamically
- **Document viewer** — Server-rendered viewer that auto-detects MIME type:
  - `video/*` → native `<video>` player
  - `image/*` → full-screen image
  - `application/pdf` → iframe
  - Other → download fallback
- **Presigned S3 URLs** — Viewer generates short-lived (1 hour) signed URLs for secure access
- **Toast notifications** — Success/error feedback throughout the UI

---

## Project Structure

```
multi-media/
├── app/
│   ├── (main)/                     # Public-facing app (Navbar + Footer)
│   │   ├── layout.tsx
│   │   ├── page.tsx                # Home — file upload
│   │   └── main-screen/
│   │       └── page.tsx            # Dashboard — sessions, files, screens
│   ├── (viewer)/
│   │   └── view/[docId]/
│   │       ├── page.tsx            # Document viewer (SSR)
│   │       └── CloseButton.tsx
│   ├── api/
│   │   ├── upload/route.ts         # POST — upload files to S3
│   │   ├── sessions/
│   │   │   ├── route.ts            # GET — all sessions
│   │   │   └── [id]/route.ts       # GET — session + documents
│   │   └── documents/[id]/route.ts # GET — single document metadata
│   └── layout.tsx                  # Root layout (fonts, metadata)
├── components/
│   ├── FileUpload.tsx
│   ├── Navbar.tsx
│   ├── Footer.tsx
│   ├── Toast.tsx
│   └── main-screen/
│       ├── SessionSidebar.tsx
│       ├── FilePanel.tsx
│       ├── ScreenPanel.tsx
│       └── shared.tsx              # Shared types, utils, StatusBadge, FileIcon
├── lib/
│   ├── prisma.ts                   # Singleton Prisma client
│   └── s3.js                       # S3 upload + presigned URL helpers
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.yaml
└── next.config.ts
```

---

## Application Flow

```
User selects files (drag-drop / browse)
        │
        ▼
POST /api/upload
  ├── Create Session (UPLOADING)
  ├── Upload each file to S3
  ├── Save Document records in DB
  └── Update Session → COMPLETED
        │
        ▼
Redirect to /main-screen
  ├── GET /api/sessions        → SessionSidebar
  ├── GET /api/sessions/{id}   → FilePanel (document grid)
  └── Drag docs to ScreenPanel (local state)
        │
        ▼
Click document → open /view/{docId} (new tab)
  ├── SSR: fetch document metadata
  ├── Generate S3 presigned URL
  └── Render by MIME type
```

---

## Database Schema

```prisma
model Session {
  id        String        @id @default(cuid())
  status    SessionStatus
  createdAt DateTime      @default(now())
  updatedAt DateTime      @updatedAt
  documents Document[]
}

model Document {
  id        String         @id @default(cuid())
  sessionId String
  name      String
  size      Int
  mimeType  String
  s3Bucket  String
  s3Key     String
  s3Url     String
  status    DocumentStatus
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt
  session   Session        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

---

## API Reference

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload files; creates session + documents |
| `GET` | `/api/sessions` | List all sessions (with document count) |
| `GET` | `/api/sessions/:id` | Get session with all documents |
| `GET` | `/api/documents/:id` | Get document metadata |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- AWS S3 bucket

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multimedia

AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
BUCKET_NAME=your_bucket_name
AWS_REGION=ap-south-1
```

### 3. Start the database

```bash
docker-compose up -d
```

### 4. Run database migrations

```bash
npx prisma migrate deploy
```

### 5. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy Locally with Docker (Auto-starts on Reboot)

This setup runs the full stack — Next.js app + PostgreSQL — in Docker containers that automatically restart whenever your system reboots or Docker restarts.

### Prerequisites

- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) installed and running

### Step 1 — Enable Docker Desktop auto-start on login

1. Open **Docker Desktop**
2. Go to **Settings → General**
3. Turn on **"Start Docker Desktop when you log in"**

This ensures Docker starts automatically every time Windows boots. All containers with `restart: always` will then start with it.

### Step 2 — Create your `.env` file

```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/multimedia

AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
BUCKET_NAME=your_bucket_name
AWS_REGION=ap-south-1
```

> Note: `DATABASE_URL` must point to `db` (the Docker service name), not `localhost`.

### Step 3 — Build and start everything

```bash
docker compose up -d --build
```

This will:
- Build the Next.js app image
- Start PostgreSQL (waits for it to be healthy before starting the app)
- Start the app on port `3000`

### Step 4 — Run database migrations

Run this once after the first start (and after any future schema changes):

```bash
docker compose exec app npx prisma migrate deploy
```

### Step 5 — Open the app

Visit [http://localhost:3000](http://localhost:3000)

---

### Common Docker Commands

| Command | Description |
|---|---|
| `docker compose up -d --build` | Build and start all services |
| `docker compose up -d` | Start all services (no rebuild) |
| `docker compose down` | Stop all services |
| `docker compose down -v` | Stop and delete database data |
| `docker compose logs -f app` | Stream app logs |
| `docker compose logs -f db` | Stream database logs |
| `docker compose exec app npx prisma studio` | Open Prisma database GUI |
| `docker compose restart app` | Restart only the app container |
| `docker compose build app` | Rebuild the app image after code changes |

### Updating after code changes

```bash
docker compose build app
docker compose up -d
```

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm start` | Run production server |
| `npm run lint` | Run ESLint |
| `npx prisma studio` | Open Prisma database GUI |
| `npx prisma migrate dev` | Create and apply a new migration |

---

## Windows Screen Player (`desktop/`)

An Electron kiosk app that plays a screen's assigned content full screen on a Windows PC.

**Flow:** download `ScreenPlayer.exe` using the sidebar's **Download Desktop App** link → open the EXE → Screen ID modal → Submit → the assigned content plays full screen. The application retains its XOS branding and existing Windows shortcuts.

Website assignments open directly in the player's website view. Ordinary links, `target="_blank"`, and HTTP/HTTPS `window.open()` requests navigate inside the same kiosk window. A touch-friendly **Back** button stays 24px from the bottom right, above website content, including cross-origin pages. It is disabled at the start of history; changing the screen or assigned website clears the previous history. The button is hidden for local media. Non-HTTP/HTTPS top-level website navigation and popup requests are blocked. Remote websites cannot access the local player command bridge.

| Key | Action |
|---|---|
| `Ctrl + R` / `F5` | Never reloads — reopens the Screen ID modal to switch screens |
| `Esc` | Closes the modal and returns to the current content |
| `Ctrl + Shift + Q` | Quits the player |

- The app syncs the assignment once at launch, caches downloaded media locally, and subscribes to Ably change notifications. Changes trigger a debounced sync; unchanged assignments keep playing. If the CMS is unavailable at launch, the last cached assignment is used. Live websites still require network access.
- The last server and Screen ID are saved in Electron's per-user `userData/config.json` directory. Existing XOS settings and shortcuts remain compatible.
- The default server address is built into the `.exe` from the `CMS_URL` GitHub Actions variable (Settings → Secrets and variables → Actions → Variables). If it's empty, the modal asks for it ("Server settings").

```bash
cd desktop
npm ci
npm start      # run locally
npm run test:navigation # real Electron navigation integration check
npm run dist   # build desktop/dist/ScreenPlayer.exe (Windows x64 portable)
npm run release # navigation check + build + verified copy to public/ScreenPlayer.exe
```

Run the release command on Windows with Node.js and npm installed. The first install/build may download Electron and electron-builder tools. The release script compares SHA-256 hashes after copying the build. Include `public/ScreenPlayer.exe` in the CMS deployment; the sidebar serves it at `/ScreenPlayer.exe`.

The automated navigation check uses a hidden Electron window and local HTTP fixtures. It covers ordinary links, new-window links, scripted popups, cross-origin Back navigation, disabled state, bottom-right positioning after resizing, assignment history reset, hiding controls for media, preload isolation, and preventing additional windows. It exits nonzero on failure. A packaged-EXE smoke test should also confirm startup, screen assignment, website navigation, existing video controls, and the Screen ID keyboard shortcuts on the target Windows display.
