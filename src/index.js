// Standalone Node.js Wisp server extracted from MercuryWorkshop/Scramjet-App.
// No Scramjet frontend, browser assets, or static file hosting runs here.
import { createServer } from "node:http";
import { promises as dns } from "node:dns";
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

// DNS for the sites people open. The default is Cloudflare for Families
// (1.1.1.3, 1.0.0.3), which answers 0.0.0.0 for sites it blocks; Wisp then
// refuses the connection and the browser sees "tls handshake eof".
// WISP_DNS_SERVERS: comma-separated servers, or "system" for the host's own.
const FAMILY_DNS = ["1.1.1.3", "1.0.0.3"];
function dnsServers(value = "") {
  const v = value.trim();
  if (!v) return FAMILY_DNS;
  if (v.toLowerCase() === "system") return null;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}
const servers = dnsServers(process.env.WISP_DNS_SERVERS);

Object.assign(wisp.options, {
  allow_udp_streams: false,
  hostname_blacklist: hostnameBlacklist(process.env.WISP_HOSTNAME_BLACKLIST),
  dns_servers: servers,
});

// GET /dns?host=example.com: what the proxy's DNS answers for a site, next to
// normal DNS (1.1.1.1), so a site the filter blocks can be told apart from a
// site that's down. Read-only; it only looks up names.
async function lookup(host, using) {
  const resolver = new dns.Resolver({ timeout: 4000, tries: 2 });
  if (using) resolver.setServers(using);
  try {
    return await resolver.resolve4(host);
  } catch (cause) {
    return { error: cause.code || String(cause.message || cause) };
  }
}
async function dnsReport(host) {
  const [proxy, normal] = await Promise.all([lookup(host, servers || undefined), lookup(host, ["1.1.1.1"])]);
  const unusable = (r) => !Array.isArray(r) || r.length === 0 || r.every((ip) => ip === "0.0.0.0");
  return {
    host,
    proxy_dns: servers ? servers.join(", ") : "system",
    proxy_answer: proxy,
    normal_answer: normal,
    blocked_by_proxy_dns: unusable(proxy) && !unusable(normal),
  };
}
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

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
  const url = new URL(req.url || "/", "http://localhost");
  if (url.pathname === "/dns") {
    const host = (url.searchParams.get("host") || "").trim().toLowerCase().replace(/\.$/, "");
    const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "access-control-allow-origin": "*" };
    if (!HOSTNAME.test(host)) {
      res.writeHead(400, headers);
      res.end(JSON.stringify({ error: "Give a hostname, like /dns?host=1v1.lol" }));
      return;
    }
    dnsReport(host).then((report) => {
      res.writeHead(200, headers);
      res.end(JSON.stringify(report, null, 2));
    }, (cause) => {
      res.writeHead(500, headers);
      res.end(JSON.stringify({ error: String(cause && cause.message || cause) }));
    });
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
  console.log("Site DNS: " + (servers ? servers.join(", ") : "system resolver"));
  if (!enabled) console.log("Wisp is not enabled; set WISP_ENABLED=true when ready to connect the frontend.");
});
