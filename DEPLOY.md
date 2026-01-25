# Get a link (GitHub + Vercel)

In the end you get a URL like `https://General-AI-xxx.vercel.app`.

---

## Option A: No Terminal (upload on GitHub)

1. **[github.com/new](https://github.com/new)** → name: `General-AI`, Public → **Create repository**. (If you already created it, go to the repo and continue.)
2. Click **“uploading an existing file”** and drag in from `/Users/macbook/ai-assistant-site/`:
   - `index.html`
   - `README.md`
   - `DEPLOY.md`
   - `.gitignore`
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

## Other options

- **Netlify:** [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git** → pick `General-AI`.
- **Vercel from your machine (no GitHub):** in the project folder run `npx vercel` and follow the prompts; you’ll get a link after login.
