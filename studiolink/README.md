# StudioLink – Deploy to Vercel

Collaborative file sharing app for remote musicians.
Built with React + Vite. Deploy in ~5 minutes.

---

## Prerequisites

- [Node.js 18+](https://nodejs.org) installed on your computer
- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account (sign up with GitHub)

---

## Step 1 — Install dependencies locally (optional, to test first)

```bash
npm install
npm run dev
```

Open http://localhost:5173 to preview. Press Ctrl+C to stop.

---

## Step 2 — Push to GitHub

1. Go to https://github.com/new and create a **new repository** (e.g. `studiolink`). Keep it public or private — either works.

2. In your terminal, inside this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/studiolink.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 3 — Deploy on Vercel

1. Go to https://vercel.com and click **"Add New Project"**
2. Click **"Import"** next to your `studiolink` repository
3. Leave all settings as defaults — Vercel auto-detects Vite
4. Click **"Deploy"**

That's it. In ~60 seconds you'll get a live URL like:
`https://studiolink-yourname.vercel.app`

---

## Step 4 — Embed in WordPress

### Option A: Custom HTML block (simplest)

In the WordPress block editor, add a **Custom HTML** block and paste:

```html
<iframe
  src="https://studiolink-yourname.vercel.app"
  width="100%"
  height="850"
  frameborder="0"
  allow="autoplay; microphone"
  style="border-radius: 12px; display: block;"
></iframe>
```

> ⚠️ The `allow="autoplay; microphone"` attribute is important for audio playback to work inside the iframe.

### Option B: Shortcode via Advanced iFrame plugin

Install the free **Advanced iFrame** plugin, then use:

```
[advanced_iframe src="https://studiolink-yourname.vercel.app" width="100%" height="850"]
```

### Option C: Full-width page template

For the best experience, create a WordPress page with a "Full Width" template
(most themes offer this) so the app fills the entire browser window without
sidebar or header interference.

---

## Updating the app

Any time you push a new commit to GitHub, Vercel automatically redeploys.
Your WordPress embed URL never changes.

```bash
# Make your edits, then:
git add .
git commit -m "Update app"
git push
```

---

## File structure

```
studiolink/
├── index.html          # HTML shell
├── vite.config.js      # Vite bundler config
├── vercel.json         # Vercel SPA routing
├── package.json        # Dependencies
└── src/
    ├── main.jsx        # React entry point
    └── App.jsx         # Main application
```

---

## Troubleshooting

**Audio doesn't play in the iframe**
Make sure your iframe tag includes `allow="autoplay"`.

**App shows blank page after deploy**
Check the Vercel build logs — usually a missing dependency. Run `npm install` locally first.

**WordPress strips the iframe tag**
Some WordPress themes/security plugins block iframes. Install **Advanced iFrame** or **iframe** plugin which whitelists your domain.
