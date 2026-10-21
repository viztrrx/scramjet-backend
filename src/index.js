// Standalone Node.js Wisp server extracted from MercuryWorkshop/Scramjet-App.
// No Scramjet frontend, browser assets, or static file hosting runs here.
import { createServer } from "node:http";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";

logging.set_level(logging.NONE);

// Optional comma-separated hostname suffixes to refuse, e.g. "badsite.test,other.test".
// The upstream demo hard-coded an example.com blacklist, which refused the
// frontend's basic test page; blocking is now opt-in.
function hostnameBlacklist(value = "") {
  const hosts = value.split(",").map((host) => host.trim().toLowerCase()).filter(Boolean);
  return hosts.length
    ? hosts.map((host) => new RegExp("(^|\\.)" + host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"))
    : null;
}

Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: hostnameBlacklist(process.env.WISP_HOSTNAME_BLACKLIST),
  dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const port = Number(process.env.PORT || 8080);
const enabled = process.env.WISP_ENABLED === "true";

const server = createServer((req, res) => {
  // Render health checks and the frontend's wake-up requests use this path.
  if (new URL(req.url || "/", "http://localhost").pathname === "/health") {
    res.writeHead(enabled ? 200 : 503, {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(enabled ? "ok" : "wisp disabled");
    return;
  }
  res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.on("upgrade", (req, socket, head) => {
  const path = new URL(req.url || "/", "http://localhost").pathname;
  if (!enabled || path !== "/wisp/") {
    socket.destroy();
    return;
  }
  wisp.routeRequest(req, socket, head);
});

server.listen(port, "0.0.0.0", () => {
  console.log("Scramjet backend listening on port " + server.address().port);
  if (!enabled) console.log("Wisp is not enabled; set WISP_ENABLED=true when ready to connect the frontend.");
});
