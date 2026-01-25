# General-AI repo is empty — add the first commit

Vercel (and similar) need at least one commit on `main`. Do **one** of the two options below.

---

## Option 1: Upload on GitHub (no Terminal)

1. Open your repo: **https://github.com/YOUR_USERNAME/General-AI**
2. If you see **"uploading an existing file"** or **"Add file"** → **"Upload files"**, use that.
3. Open Finder and go to: **`/Users/macbook/ai-assistant-site/`**
4. Drag these into the browser window (all at once or one by one):
   - **index.html** (required — main page)
   - **api** folder (required — contains **chat.js** and **status.js** for /api/chat; 404 happens if this is missing)
   - **package.json** (required — API needs it for pdf-parse)
   - README.md, DEPLOY.md, .gitignore (optional; for .gitignore, press `Cmd+Shift+.` in Finder to show dotfiles)
5. In the box at the bottom, type: **Initial commit**
6. Click **"Commit changes"** (green button).

The repo will have a `main` branch. In Vercel: **Import** General-AI again (or **Redeploy**); it should work.

---

## Option 2: Push from Terminal

In **Terminal**:

```bash
cd /Users/macbook/ai-assistant-site

git init
git add .
git commit -m "Initial: AI Assistant"

git remote add origin https://github.com/YOUR_USERNAME/General-AI.git
git branch -M main
git push -u origin main
```

Replace **YOUR_USERNAME** with your GitHub username.  
If `git` says "detected dubious ownership" or "safe.directory", run:

```bash
git config --global --add safe.directory /Users/macbook/ai-assistant-site
```

then repeat the `git init` and the rest.

---

## After the repo has code

1. **Vercel:** **Add New** → **Project** → **Import** `General-AI` → **Deploy** (or **Redeploy** if it was already imported).
2. Your link: **https://general-ai-xxxx.vercel.app** (or the URL Vercel shows).
