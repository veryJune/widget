# BaroName

Private AI naming workspace for global-first brand names.

## Quick Start

Install dependencies:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' install
```

Create `.env.local` from `.env.example`, then run:

```powershell
& 'C:\Program Files\nodejs\npm.cmd' run dev
```

Open:

```text
http://localhost:3000
```

## Environment Variables

```text
GEMINI_API_KEY=
APP_PASSWORD=
SESSION_SECRET=
GEMINI_MODEL=gemini-3.5-flash
GENERATION_COOLDOWN_SECONDS=8
```

See `SETUP_AND_DEPLOY.md` for Gemini API key and Vercel deployment steps.
