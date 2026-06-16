# claude-ground

A personal **project gallery**. The home screen is a grid of works I've built;
clicking a card opens that work — and the work only loads and runs *when you
click in*, never on the home screen.

🔗 Live: `https://<user>.github.io/claude-ground/`

## How it works

- **Home (`#/`)** — a grid of cards driven by `src/projects/registry.ts`.
- **Open a project (`#/p/<id>`)** — renders that work full-screen.
  - **React projects** are code-split with `React.lazy`, so their JavaScript is
    downloaded on demand. Heavy works (e.g. the three.js scene) don't load until
    opened.
  - **Static projects** (plain HTML, p5.js, canvas games, …) live under
    `public/projects/<id>/` and are shown in a sandboxed `<iframe>`, also only
    when opened.

Routing is hash-based (`#/...`), so deep links survive refreshes on GitHub
Pages without any server config.

## Adding a new work

### A React work

1. Create `src/projects/<id>/index.tsx` (or a folder) with a **default export**
   React component.
2. Register it in `src/projects/registry.ts`:

   ```ts
   {
     id: 'my-work',
     title: 'My Work',
     description: 'One line about it.',
     emoji: '✨',
     tags: ['react'],
     kind: 'react',
     load: () => import('./my-work'),
   }
   ```

### A static work (HTML / p5.js / game / …)

1. Drop a self-contained page at `public/projects/<id>/index.html` (plus any
   assets it needs alongside it).
2. Register it:

   ```ts
   {
     id: 'my-work',
     title: 'My Work',
     description: 'One line about it.',
     emoji: '🎮',
     tags: ['html'],
     kind: 'iframe',
     path: 'projects/my-work/index.html',
   }
   ```

That's it — the gallery picks it up automatically.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build
npm run lint
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to GitHub Pages.

## Projects

| Project | Kind | Description |
| --- | --- | --- |
| 🍃 Cozy Cove | react / three.js | A hand-held 3D diorama you can orbit around. |
| 🟣 Bouncing Orbs | html / canvas | A zero-dependency canvas physics toy. |
