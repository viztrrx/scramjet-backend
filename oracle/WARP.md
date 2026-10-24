# WARP egress (optional) — stop looking like a datacenter

Sites like Google and YouTube show "are you a robot" checks and return 429s
more often when the request comes from a datacenter IP, which is what a cloud
VM has. Routing the Wisp server's **outbound** traffic through **Cloudflare
WARP** gives it a consumer-looking IP instead, which cuts down those checks.

> **Heads up — this is a recipe, not a tested setup.** Unlike the rest of
> `oracle/`, nobody has run this end to end here. It's correct by design, but
> verify each step on your VM, and check the
> [wisp-server-python](https://github.com/MercuryWorkshop/wisp-server-python)
> README for the exact run command in case its flags have changed.

## Do you even need it?

For **YouTube specifically, no** — the frontend opens YouTube through
Invidious, and the Invidious server fetches the video from YouTube, so YouTube
never sees your backend's IP. WARP helps for *other* sites that block
datacenter IPs. If YouTube is all you care about, you can skip this.

WARP also **only applies to the self-hosted VM** (this `oracle/` setup). It
can't run on Render's free plan.

## Why it's built this way

`epoxy-server` (the Rust Wisp server in the base setup) has no option to send
its outbound traffic through a proxy. So the overlay swaps in **wisp-server-
python**, which does, and points it at a **WARP SOCKS5 proxy** container. Only
the Wisp server's *outbound* traffic goes through WARP; inbound (Caddy →
Wisp) is untouched, so this doesn't break the HTTPS front like a full-tunnel
VPN on the host would.

Files, all under `oracle/warp/`:
- `docker-compose.warp.yml` — adds the `warp` (SOCKS5) and `wisp-warp` (Python
  Wisp) services and points Caddy's `/wisp/` at `wisp-warp`.
- `pywisp/Dockerfile` — the Python Wisp server, outbound via `socks5h://warp:1080`.

## Run it

From the `oracle/` folder, start the base setup **with** the overlay:

```sh
docker compose -f docker-compose.yml -f warp/docker-compose.warp.yml up -d --build
```

A free WARP account registers itself on first start (no login needed). Give it
a minute, then check the backend still answers:

```sh
curl https://yourdomain/health          # -> ok
```

## Confirm the egress IP actually changed

Open a what-is-my-IP site **through the proxy** (in the frontend) and compare it
to the VM's own IP (`curl -s https://ifconfig.me` on the VM). Through the proxy
you should see a **Cloudflare WARP** IP, not the VM's. If they're the same, the
Wisp server isn't using the SOCKS proxy — check `docker compose logs wisp-warp`
and `docker compose logs warp`.

## Trade-offs

- **Slower.** The Python Wisp server is slower than the Rust one, and WARP adds
  a hop. Expect lower throughput.
- **No family-filter DNS on this path.** `socks5h` resolves names at the WARP
  exit, so `WISP_DNS_SERVERS` (Cloudflare for Families) does **not** apply here —
  WARP's own resolver is used. Hostname blocking in `../epoxy/config.toml` also
  doesn't apply, since the Rust server isn't in the path; block hosts in the
  Python server's own config instead (see its README).
- **No UDP.** WARP's SOCKS doesn't carry UDP (the server runs with
  `--block-udp`), same as the base setup's `allow_udp = false`.
- **WARP IPs get flagged too.** Google sometimes rate-limits WARP's exit IPs as
  well. It's better than a datacenter IP, not a guarantee. A residential or ISP
  SOCKS5 proxy (set in place of `socks5h://warp:1080`) is more reliable if you
  have one.

## Going back

Start without the overlay and you're on the Rust server again, no WARP:

```sh
docker compose up -d --build
```
