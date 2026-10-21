# Scramjet backend — Render

This is the **Node.js/Wisp backend-only** part of [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App), separated from the browser frontend.

The frontend is in [viztrrx/scramjet-frontend](https://github.com/viztrrx/scramjet-frontend) and runs on Cloudflare Workers at `https://frontend.viztrrx.workers.dev`. It connects to this backend at `wss://backend-ivvq.onrender.com/wisp/` (set in the frontend's `public/config.js`). This backend does **not** serve HTML, browser scripts, or the Scramjet frontend.

## Deploy to Render

`render.yaml` is a Render Blueprint for this service. For an existing service, set the same values in the Render dashboard:

| Setting | Value |
|---|---|
| Runtime | Node (22) |
| Build command | `npm install --omit=dev` |
| Start command | `npm start` |
| Health check path | `/health` |
| `WISP_ENABLED` | `true` (required; without it every WebSocket is closed and `/health` returns 503) |
| `WISP_HOSTNAME_BLACKLIST` | optional, comma-separated hostnames to refuse (subdomains included) |

Render sets `PORT`; the server listens on `0.0.0.0`. Free instances sleep when idle and may take about a minute to wake; the frontend retries the WebSocket while that happens.

## Endpoints

- `GET /health` — `200 ok` when Wisp is enabled, `503` otherwise.
- `wss://…/wisp/` — the Wisp endpoint used by the frontend's libcurl transport.

Wisp refuses UDP streams and connections to loopback/private addresses, and resolves hostnames through Cloudflare's filtering DNS (`1.1.1.3`, `1.0.0.3`).

## Tests

```sh
npm install
npm test
```

The tests start the real server and check the health endpoint, the Wisp endpoint, and the hostname blacklist behaviour.

Original license: AGPL-3.0, see [LICENSE](./LICENSE). Original project: [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App).
