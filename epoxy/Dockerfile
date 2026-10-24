# epoxy-server: MercuryWorkshop's Wisp server in Rust (from the epoxy-tls repo).
# Pinned to a known commit; change EPOXY_COMMIT to update.
FROM rustlang/rust:nightly-bookworm AS build
ARG EPOXY_COMMIT=9cde724aea1a0f5e46b1c962b3d19ca1389af074
WORKDIR /src
# Full git checkout: the build script reads the commit hash for --version.
RUN git init -q . \
 && git remote add origin https://github.com/MercuryWorkshop/epoxy-tls \
 && git fetch -q --depth 1 origin "$EPOXY_COMMIT" \
 && git checkout -q FETCH_HEAD
RUN cargo build --release -p epoxy-server

FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/target/release/epoxy-server /usr/local/bin/epoxy-server
COPY *.toml /etc/epoxy/
USER nobody
EXPOSE 4000
CMD ["epoxy-server", "/etc/epoxy/config.toml"]
