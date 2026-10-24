# Python Wisp server (MercuryWorkshop/wisp-server-python), which unlike
# epoxy-server can send its outbound traffic through a SOCKS5 proxy — here the
# WARP container. Used only by the WARP overlay (warp/docker-compose.warp.yml).
#
# NOTE: this is a recipe, not a build anyone has run end to end here. Check the
# wisp-server-python README for the exact run command and flags before relying
# on it; adjust the CMD below if the module path or options have changed.
FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends git \
 && pip install --no-cache-dir "git+https://github.com/MercuryWorkshop/wisp-server-python" \
 && apt-get purge -y git && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
EXPOSE 6001
# --proxy socks5h://warp:1080  all outbound (and DNS) through WARP
# --block-udp                  WARP's SOCKS does not carry UDP
CMD ["python", "-m", "wisp.server", "--host", "0.0.0.0", "--port", "6001", "--proxy", "socks5h://warp:1080", "--block-udp"]
