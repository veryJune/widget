# PromptBuilder

Personal prompt manager for Vercel + Neon Postgres.

## Storage Model

- The browser keeps a local cache for speed and emergency fallback.
- Vercel Serverless Functions protect the data with a private password.
- Neon Postgres stores the shared PromptBuilder data in `promptbuilder_data`.
- JSON/CSV export and JSON/CSV import remain available as manual backup and restore.

## Required Vercel Environment Variables

Set these in Vercel Project Settings > Environment Variables.

```text
DATABASE_URL=your_neon_postgres_connection_string
APP_PASSWORD=your_private_promptbuilder_password
SESSION_SECRET=a_long_random_secret
PROMPTBUILDER_USER_ID=default
```

`SESSION_SECRET` can be any long random text. `PROMPTBUILDER_USER_ID` can stay `default` for one-person use.

## Deploy Steps

1. Create or open a Vercel account.
2. Import this GitHub repository into Vercel.
3. When Vercel asks for the project root, choose `PromptBuilder`.
4. Add a Neon Postgres database from Vercel Marketplace or Neon.
5. Copy the Neon connection string into `DATABASE_URL`.
6. Add `APP_PASSWORD`, `SESSION_SECRET`, and `PROMPTBUILDER_USER_ID`.
7. Deploy.
8. Open the deployed URL and enter the password.

On first login, if the database is empty, the app saves the current local PromptBuilder data into Neon.

## Future Multi-user Path

The current app uses a single `PROMPTBUILDER_USER_ID`.

Later, it can be expanded into real user accounts by replacing the single password with users, sessions, and per-user `user_id` values in the database.
