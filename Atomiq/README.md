# Atomiq

Atomic tasks. Instant action.

Atomiq turns a large goal into focused micro-task cards. The first version includes:

- Goal input with fast or detailed splitting
- Daily time presets
- Gemini-backed structured task generation
- Focused workspace with one active card
- Completion progress and Markdown export
- Local demo fallback when `GEMINI_API_KEY` is not set

## Getting Started

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Gemini Setup

Create `.env.local` from `.env.example`:

```bash
GEMINI_API_KEY=your_gemini_api_key_here
```

The key is read only inside the server route at `src/app/api/deconstruct/route.ts`.

## Deploying to Vercel

Add `GEMINI_API_KEY` in Vercel Project Settings, then deploy the GitHub repository.
