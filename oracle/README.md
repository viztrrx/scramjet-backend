# Running the backend on Oracle Cloud (Always Free)

This folder runs the backend on an Oracle Cloud Always Free ARM VM. Unlike Render free, the VM never sleeps and has far more CPU and bandwidth.

| Container | What it does |
|---|---|
| `wisp` | [epoxy-server](https://github.com/MercuryWorkshop/epoxy-tls/tree/main/server), MercuryWorkshop's Wisp server written in Rust. Handles `wss://<domain>/wisp/`. Settings are in [`epoxy/config.toml`](epoxy/config.toml). |
| `api` | The Node server from `src/index.js`. Here it only answers `/health` and `/dns`. |
| `caddy` | Serves HTTPS on ports 80/443, gets the certificate automatically, and sends `/wisp/` to `wisp` and everything else to `api`. |

The frontend works unchanged apart from the backend URL. It still connects to `wss://<domain>/wisp/` and still calls `/health`.

You do everything below from **Terminal on your Mac**, and later over SSH on the VM.

---

## 1. Create the Oracle account

1. Sign up at <https://signup.cloud.oracle.com>. A card is required for verification. Always Free resources are not charged.
2. **Choose your home region carefully, because it can't be changed later.** Pick the region closest to the people who use the proxy. Big regions such as Ashburn, Phoenix and Frankfurt often run out of free ARM capacity, so a smaller nearby region can be easier.

## 2. Make an SSH key (on the Mac)

```sh
ssh-keygen -t ed25519 -f ~/.ssh/oracle -N ""
cat ~/.ssh/oracle.pub   # copy this whole line
```

## 3. Create the VM

In the Oracle console, go to **Compute → Instances → Create instance**:

- **Image:** Canonical Ubuntu 24.04 (the default build for Ampere/aarch64 is right).
- **Shape:** click *Change shape* → **Ampere** → `VM.Standard.A1.Flex`, then set **4 OCPUs** and **24 GB** memory. That's the whole free allowance.
- **Networking:** create a new virtual cloud network with a **public subnet**, and keep **Assign a public IPv4 address** checked.
- **SSH keys:** choose *Paste public keys* and paste the line from step 2.
- Create it, then copy the **Public IP address** from the instance page.

If you get **"Out of host capacity"**, try a different availability domain, try fewer cores (2 OCPU / 12 GB is still far faster than Render), or try again later. You can also upgrade the account to *Pay As You Go*, which usually unlocks capacity, and Always Free resources stay free.

## 4. Open ports 80 and 443 in Oracle's firewall

Open the instance page, click the **subnet** (under *Primary VNIC*), open its **Security** tab or **Security Lists**, choose the default security list, then choose **Add Ingress Rules**. Add three rules, each with source CIDR `0.0.0.0/0`:

| Protocol | Destination port |
|---|---|
| TCP | 80 |
| TCP | 443 |
| UDP | 443 |

## 5. Get a domain name

HTTPS (and therefore `wss://`) needs a domain name that points to the VM's IP.

- **Free:** at <https://www.duckdns.org>, sign in, create a subdomain such as `mybackend`, and set its IP to the VM's public IP. Your domain is then `mybackend.duckdns.org`.
- **Your own domain:** add an `A` record pointing to the VM's IP. If the domain is on Cloudflare, set the record to **DNS only** (grey cloud) so Caddy can get its certificate and traffic goes straight to the VM.

## 6. Log in to the VM

```sh
ssh -i ~/.ssh/oracle ubuntu@<PUBLIC_IP>
```

Everything from here runs **on the VM**.

## 7. Open the ports on the VM itself

Oracle's Ubuntu images also block everything except SSH in their own firewall:

```sh
sudo iptables -I INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT
sudo iptables -I INPUT -p udp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 8. Install Docker

```sh
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
exit
```

Then SSH back in (step 6) so the group change applies.

## 9. Start the backend

```sh
git clone https://github.com/viztrrx/scramjet-backend
cd scramjet-backend/oracle
cp .env.example .env
nano .env        # set DOMAIN=yourname.duckdns.org, then Ctrl+O, Enter, Ctrl+X
docker compose up -d --build
```

The first build compiles the Rust server and takes about 5–10 minutes. Later builds are quicker.

Check it from the VM or from your Mac:

```sh
curl https://yourname.duckdns.org/health                  # -> ok
curl "https://yourname.duckdns.org/dns?host=example.com"  # -> JSON report
```

If `/health` fails right after starting, wait a minute while Caddy gets the certificate, then check `docker compose logs caddy`. Certificate errors almost always mean the domain doesn't point to the VM's IP yet, or that ports 80/443 aren't open (steps 4 and 7).

## 10. Point the frontend at it

In [viztrrx/frontend](https://github.com/viztrrx/frontend):

- `public/config.js`: `wispUrl: "wss://yourname.duckdns.org/wisp/"`
- `src/index.js`: `FALLBACK_HEALTH_URL = "https://yourname.duckdns.org/health"`

Deploy the frontend. When everything works, you can suspend the Render service. The frontend's 10-minute `/health` ping is no longer needed but does no harm.

---

## Day-to-day

| Task | Command (in `scramjet-backend/oracle`) |
|---|---|
| See if it's running | `docker compose ps` |
| Logs | `docker compose logs -f wisp` (or `api`, `caddy`) |
| Update after a `git push` | `git pull && docker compose up -d --build` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` |

The containers start again by themselves after a VM reboot. Ubuntu installs security updates automatically. Run `sudo apt update && sudo apt upgrade` now and then for everything else.

**Blocking sites:** add regexes to `block_hosts` in `epoxy/config.toml` (for example `'(^|\.)badsite\.test$'`), then run `docker compose up -d --build`.

**DNS filtering:** `dns_servers` in `epoxy/config.toml` defaults to Cloudflare for Families, the same as on Render. If you change it, also set `WISP_DNS_SERVERS` for `api` in `docker-compose.yml` so `/dns` reports the same thing.

**Going back to the Node Wisp server:** in `Caddyfile`, change `reverse_proxy wisp:4000` to `reverse_proxy api:8080`, then run `docker compose restart caddy`.
