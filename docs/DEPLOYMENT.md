# Deployment — GitHub Pages

The game is a static Vite/Phaser build published to **GitHub Pages** by
`.github/workflows/deploy.yml`. Live URL (once enabled):

> **https://qemmhd.github.io/zombie-cafe-game/**

## One-time setup (repo owner — required)

The CI token is **not permitted to create the Pages site** itself
(`Resource not accessible by integration`), so Pages must be turned on by hand
**once**:

1. Go to the repo on GitHub → **Settings** → **Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. (If prompted about a deployment branch for the `github-pages` environment,
   allow the branch you deploy from — `main`, or the active `claude/**` remake
   branch. Settings → Environments → `github-pages` → Deployment branches.)

That's it. After this, **every push** that touches the web app re-builds and
re-deploys automatically — no further manual steps.

## How it works

- **Trigger:** push to `main` or any `claude/**` branch (see `on.push.branches`).
- **Build job:** `npm ci` → `npm run build` (`tsc` typecheck + `vite build`) →
  uploads `dist/` as the Pages artifact.
- **Deploy job:** `actions/deploy-pages` publishes the artifact.
- **Base path:** `vite.config.ts` sets `base: '/zombie-cafe-game/'` for the
  project-site URL. If the repo is renamed, update that value.

## Verifying a deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://qemmhd.github.io/zombie-cafe-game/
```

`200` = live. `404` "Site not found" = Pages not enabled yet (do the one-time
setup above) or the first deploy is still propagating (~1 min).

## Local preview

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build && npm run preview
```
