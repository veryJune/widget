# Prompt Dock

Prompt Dock is a lightweight personal prompt launcher for text prompts, GPTs, Gems, Perplexity links, and other AI tools.

## What It Does

- Add, edit, delete, and favorite prompt items in the web UI
- Search by title, summary, category, tag, prompt body, or platform
- Switch between card, list, and compact views
- Filter by platform and editable categories
- Use tag suggestions based on existing tags and simple Korean/English aliases
- Copy prompts with one click
- Open GPTs, Gems, Perplexity, or reference links
- Fill `{variables}` in prompts before copying
- Export and import JSON or CSV backups

## How To Use

Open `index.html` in a browser.

The app stores data in your browser with local storage. Use export/import for backups or moving data between browsers.

## GitHub Pages

This project is a static web app, so it can be hosted on GitHub Pages.

1. Create a GitHub repository.
2. Upload `index.html`, `styles.css`, `app.js`, and this `README.md`.
3. Enable GitHub Pages from the repository settings.

For the MVP, data is saved in the user's browser rather than pushed back to GitHub. This keeps setup simple and avoids exposing GitHub tokens in the browser.
