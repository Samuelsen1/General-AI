# Get a link (GitHub + Vercel)

In the end you get a URL like `https://General-AI-xxx.vercel.app`.

---

## Option A: No Terminal (upload on GitHub)

1. **[github.com/new](https://github.com/new)** → name: `General-AI`, Public → **Create repository**. (If you already created it, go to the repo and continue.)
2. Click **“uploading an existing file”** and drag in from `/Users/macbook/ai-assistant-site/`:
   - **`index.html`**
   - **`api`** folder (with `chat.js` and `status.js` inside — required for /api/chat)
   - **`package.json`** (required for the API)
   - **`images`** folder with **`g.png`** inside (app logo; see `images/.gitkeep`)
   - `README.md`, `DEPLOY.md`, `.gitignore`
3. Commit (e.g. “Initial”).
4. **[vercel.com](https://vercel.com)** → **Add New → Project** → **Import** `General-AI` → **Deploy**.
5. Use the Vercel URL as your link.

---

## Option B: Terminal + Git

### 1. Push to GitHub

In Terminal:

```bash
cd /Users/macbook/ai-assistant-site

git init
git add .
git commit -m "Initial: AI Assistant"

# Add your General-AI repo (replace YOUR_USERNAME with your GitHub username):
git remote add origin https://github.com/YOUR_USERNAME/General-AI.git
git branch -M main
git push -u origin main
```

---

## 2. Deploy on Vercel (free)

1. Go to **[vercel.com](https://vercel.com)** and sign in (GitHub is easiest).
2. **Add New…** → **Project**.
3. **Import** your `General-AI` repo.
4. Click **Deploy** (no settings to change).
5. Your link: **https://General-AI-xxxx.vercel.app** (or similar). Use that link to open the AI.

---

## If you get "404 This page could not be found"

The **`api`** folder and **`package.json`** must be in the repo. If you only uploaded `index.html` and a few docs, `/api/chat` does not exist.

1. **Add the missing files** to GitHub: the **`api`** folder (with **`chat.js`** and **`status.js`**) and **`package.json`**.
2. **Redeploy** on Vercel: Project → **Deployments** → ⋮ on the latest → **Redeploy**, or push a new commit.
3. In Vercel **Settings → Environment Variables**, add **`DEEPSEEK_API_KEY`** or **`OPENAI_API_KEY`** (see [ENV.md](ENV.md)).

---

## Other options

- **Netlify:** [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git** → pick `General-AI`.
- **Vercel from your machine (no GitHub):** in the project folder run `npx vercel` and follow the prompts; you’ll get a link after login.
