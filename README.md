# Scramjet backend — Railway

This is the **Node.js/Wisp backend-only** part of [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App), separated from the browser frontend.

The frontend is in [viztrrx/scramjet-frontend](https://github.com/viztrrx/scramjet-frontend). This backend does **not** serve HTML, browser scripts, or the Scramjet frontend.

## Deploy to Railway

Connect this repository as a Node.js service in Railway. The `start` command is `npm start`; Railway sets `PORT` and the server listens on `0.0.0.0`.

The split leaves Wisp **disabled initially** (`WISP_ENABLED` is not set). This is intentionally an unconnected codebase, not an already-active public networking relay. After the two applications are deployed and you're ready to configure their connection, the relevant backend setting is `WISP_ENABLED=true` and the frontend reads `wss://YOUR-RAILWAY-HOST/wisp/` from `public/config.js`.

No frontend URL or Railway domain has been invented or hardcoded.

Original license: AGPL-3.0, see [LICENSE](./LICENSE). Original project: [MercuryWorkshop/Scramjet-App](https://github.com/MercuryWorkshop/Scramjet-App).

**Not deployed or tested live.** Railway is not yet connected to this repository.
