# GitHub Repo Board

A drag-and-drop board of your GitHub repositories, with stage columns (Backlog → Ready → In Development → Review & Testing → Live & Maintaining → Archived). Each card can carry your own notes, status tags, an avatar and a priority position.

- **Read-only on GitHub.** It lists repositories and never changes anything on GitHub.
- **No dependencies, no build step.** Node 18+ and four static files.
- **Your board data stays local** in `data/board.json` (Git-ignored).

## Run it

```bash
git clone https://github.com/shrocktech/repo-board.git
cd repo-board
GITHUB_TOKEN=<token> npm start      # or: gh auth login && npm start
# open http://127.0.0.1:4870/
```

GitHub access comes from `GITHUB_TOKEN`. When that isn't set, the server asks a signed-in GitHub CLI (`gh auth token`). A fine-grained token with **Metadata: read** on the repositories you want is enough. A classic token needs `repo` to see private repositories.

| Variable | Default | Purpose |
| --- | --- | --- |
| `GITHUB_TOKEN` | `gh auth token` | GitHub API access (read only) |
| `PORT` / `HOST` | `4870` / `127.0.0.1` | Where the server listens. It stays on loopback unless you change `HOST` |
| `DATA_DIR` | `./data` | Where `board.json` is kept |
| `REPO_OWNER` | all | Show only one user's or organization's repositories |
| `BOARD_STAGES` | the six above | Comma-separated column names. The last one is the Archive column |

Test: `npm test` runs offline against a fake GitHub API.

## Using it

- **Select repositories** chooses which repositories appear. Hidden cards keep their notes and position.
- **Drag** a card to another column, or drop it on another card to place it above that card. The top card has the highest priority.
- **Click a card** to set its stage, status tags, notes and avatar, or to move it up or down with the keyboard.
- **Sync GitHub** reloads the repository list. It is otherwise cached for 5 minutes.
- The sun icon switches between light and dark.

## Files

| File | What it does |
| --- | --- |
| `server.mjs` | HTTP server: static files, `GET /api/account`, `GET`/`POST /api/repositories`, and the GitHub REST calls |
| `public/index.html` | Page markup: the toolbar, the board, and the card and selection dialogs |
| `public/board.js` | Rendering, drag and drop, dialogs, avatar picker, and the not-connected sample board |
| `public/board.css` | Theme tokens (top of the file), then the controls, board, cards and dialogs |
| `test.mjs` | Offline API test |

### API

`GET /api/repositories` returns `{revision, stages, tags, cards[]}`. Each card combines GitHub facts (`repo`, `url`, `description`, `private`, `branch`, `updated`) with your saved fields (`stage`, `notes`, `labels`, `avatar`, `hidden`, `order`).

`POST /api/repositories` takes `{revision, cards[]}`: the whole card list in priority order. The server refuses the save with 409 if `revision` is stale, which stops two tabs from overwriting each other. It also refuses writes sent from another website's origin.

## Adding it to another project

- **As its own service:** run it next to the project and link to it or embed it in an `<iframe>`.
- **Inside an existing Node server:** `import {server} from './repo-board/server.mjs'`, or copy its request handler into your own router, and serve `public/` as static files.
- **Rebrand:** edit the token block at the top of `public/board.css` (`--bg`, `--card`, `--accent`, the stage colours, and `--rs` for corner roundness).
- **Another backend:** keep `public/` and implement the two endpoints above in any language. The JSON shapes are the whole contract.

Extracted from Launchpad's GitHub page (`dashboard/public/repositories.*` and the `/api/issues/repositories` handler in `dashboard/issues.mjs`). The Launchpad-specific parts were left out: device-flow sign-in, sharing the login with other apps, and the shared Launchpad header and styles.
