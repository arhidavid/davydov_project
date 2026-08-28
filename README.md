# TaskFlow

A small, modern full-stack task manager used to exercise the project's Cloud Agent
development environment end to end.

- **Client** — React + Vite + TypeScript single-page app with a modern UI (`client/`)
- **Server** — Express + TypeScript REST API with dependency-free JSON-file persistence (`server/`)

The two packages are wired together with npm workspaces. In development the Vite dev
server proxies `/api/*` requests to the API, so the whole app runs with a single install.

## Requirements

- Node.js >= 20 (developed against Node 22)
- npm >= 10

## Getting started

```bash
npm install       # installs all workspaces
npm run dev       # starts the API (:3001) and the web app (:5173) together
```

Then open http://localhost:5173.

You can also start the services separately:

```bash
npm run dev:server   # Express API on http://localhost:3001
npm run dev:client   # Vite dev server on http://localhost:5173
```

## Useful commands

| Command | Description |
| --- | --- |
| `npm install` | Install dependencies for every workspace |
| `npm run dev` | Run the API and web client together |
| `npm run build` | Type-check and build both packages |
| `npm run typecheck` | Type-check both packages without emitting |
| `npm test` | Run the server test suite (Vitest + Supertest) |

## API

Base URL: `http://localhost:3001`

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Health probe |
| `GET` | `/api/tasks` | List tasks (newest first) |
| `POST` | `/api/tasks` | Create a task — body `{ "title": string }` |
| `PATCH` | `/api/tasks/:id` | Update `title` and/or `completed` |
| `DELETE` | `/api/tasks/:id` | Delete a task |

Tasks are persisted to `server/data/tasks.json` (git-ignored). Override the location
with the `DATA_FILE` environment variable and the port with `PORT`.

## Project layout

```
.
├── client/            # React + Vite front end
├── server/            # Express + TypeScript API
├── .cursor/           # Cloud Agent environment configuration
└── package.json       # npm workspaces + top-level scripts
```
