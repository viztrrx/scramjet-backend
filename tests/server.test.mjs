import assert from "node:assert/strict";
import { test } from "node:test";
import { spawn } from "node:child_process";
import { client as wispClient } from "@mercuryworkshop/wisp-js/client";

// Starts the real server on a free port and returns its base URL.
async function startServer(env) {
  const child = spawn(process.execPath, ["src/index.js"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: "0", ...env },
    stdio: ["ignore", "pipe", "inherit"],
  });
  const port = await new Promise((resolve, reject) => {
    child.stdout.on("data", (chunk) => {
      const match = /listening on port (\d+)/.exec(String(chunk));
      if (match) resolve(Number(match[1]));
    });
    child.on("exit", (code) => reject(new Error("server exited with " + code)));
  });
  return { child, base: "127.0.0.1:" + port };
}

// Opens a Wisp TCP stream and reports its close reason, or "open" if the
// server didn't refuse it within the timeout.
function streamOutcome(base, host, port, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const connection = new wispClient.ClientConnection("ws://" + base + "/wisp/");
    const timer = setTimeout(() => { connection.ws.close(); resolve("open"); }, timeoutMs);
    connection.onerror = () => { clearTimeout(timer); reject(new Error("wisp connection failed")); };
    connection.onopen = () => {
      const stream = connection.create_stream(host, port);
      stream.onclose = (reason) => { clearTimeout(timer); connection.ws.close(); resolve(reason); };
    };
  });
}

const HOST_BLOCKED = 0x48;

test("health endpoint reports whether Wisp is enabled", async (t) => {
  const on = await startServer({ WISP_ENABLED: "true" });
  t.after(() => on.child.kill());
  const ok = await fetch("http://" + on.base + "/health");
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), "ok");

  const off = await startServer({ WISP_ENABLED: "" });
  t.after(() => off.child.kill());
  assert.equal((await fetch("http://" + off.base + "/health")).status, 503);
});

test("example.com is not refused by a hostname blacklist", async (t) => {
  const server = await startServer({ WISP_ENABLED: "true", WISP_HOSTNAME_BLACKLIST: "" });
  t.after(() => server.child.kill());
  // Loopback stays blocked, which shows HostBlocked refusals are observable here.
  assert.equal(await streamOutcome(server.base, "127.0.0.1", 80), HOST_BLOCKED);
  assert.notEqual(await streamOutcome(server.base, "example.com", 80), HOST_BLOCKED);
});

test("WISP_HOSTNAME_BLACKLIST blocks a host and its subdomains only", async (t) => {
  const server = await startServer({ WISP_ENABLED: "true", WISP_HOSTNAME_BLACKLIST: "blocked.test" });
  t.after(() => server.child.kill());
  assert.equal(await streamOutcome(server.base, "blocked.test", 80), HOST_BLOCKED);
  assert.equal(await streamOutcome(server.base, "www.blocked.test", 80), HOST_BLOCKED);
  assert.notEqual(await streamOutcome(server.base, "notblocked.test", 80, 2500), HOST_BLOCKED);
});
