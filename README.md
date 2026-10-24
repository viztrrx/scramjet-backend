# Scramjet backend — Render

This is the **Node.js/Wisp backend-only** part of [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App), separated from the browser frontend.

The frontend is in [viztrrx/frontend](https://github.com/viztrrx/frontend) and runs on Cloudflare Workers at `https://frontend.viztrrx.workers.dev`. It connects to this backend at `wss://backend-ivvq.onrender.com/wisp/` (set in the frontend's `public/config.js`). This backend does **not** serve HTML, browser scripts, or the Scramjet frontend.

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
| `WISP_DNS_SERVERS` | optional. DNS servers for the sites people open, comma-separated, or `system` for Render's own resolver. Default: Cloudflare for Families (`1.1.1.3,1.0.0.3`), which blocks malware and adult sites |

Render sets `PORT`; the server listens on `0.0.0.0`. Free instances sleep when idle and may take about a minute to wake; the frontend retries the WebSocket while that happens.

## Deploy to Oracle Cloud (faster, free)

[`oracle/`](./oracle) runs the backend on an Oracle Cloud Always Free ARM VM, with Docker Compose and Caddy for HTTPS. Wisp is served by MercuryWorkshop's Rust `epoxy-server`, and this Node server answers `/health` and `/dns`. The VM never sleeps and has much more CPU and bandwidth than Render free. See [oracle/README.md](./oracle/README.md) for step-by-step setup.

## Endpoints

- `GET /health` — `200 ok` when Wisp is enabled, `503` otherwise.
- `wss://…/wisp/` — the Wisp endpoint used by the frontend's transports (libcurl, Epoxy).
- `GET /dns?host=example.com` — what the proxy's DNS answers for a site, next to normal DNS (1.1.1.1). `"blocked_by_proxy_dns": true` means the family filter blocks it: Wisp refuses sites that resolve to `0.0.0.0`, and the browser shows "tls handshake eof" or a failed connection.

Wisp refuses UDP streams and connections to loopback/private addresses, and resolves hostnames through Cloudflare's filtering DNS (`1.1.1.3`, `1.0.0.3`) unless `WISP_DNS_SERVERS` says otherwise.

## Saved sessions

Saved proxy sessions (the "Your sessions" list on the frontend's `saints://home`) are not stored on this backend: Render's free disk is wiped on every restart. They are kept in Cloudflare R2 by the frontend Worker, per Saints account; see "Saved sessions" in the frontend's README. This server only relays the Wisp traffic, so a restart here never signs anyone out.

## Tests

```sh
npm install
npm test
```

The tests start the real server and check the health endpoint, the Wisp endpoint, and the hostname blacklist behaviour.

Original license: AGPL-3.0, see [LICENSE](./LICENSE). Original project: [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App).
