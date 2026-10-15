# CluePop

A bright, mobile-first themed crossword game built with React and Vite. It is a completely static app with no server, ads, accounts, or database:

- Incomplete puzzle progress is stored in `sessionStorage`.
- Completed puzzles are stored in `localStorage` and shown in the **Solved** collection.
- Puzzle definitions ship inside the app, so it works on GitHub Pages.
- The touch-first game screen includes an on-screen keyboard, hints, coins, a timer, clue navigation, and progress feedback.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

## Production build

```bash
npm run build
npm run preview
```

## Publish

Every push to `main` automatically builds and publishes the app to:

`https://seroujk.github.io/crossword-puzzle/`
