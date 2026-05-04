# syntax=docker/dockerfile:1.7
#
# Multi-stage Dockerfile for the SabNode Rust API binary.
#
# We use `cargo-chef` to cache dependency compilation independently from the
# source tree, then a `debian:bookworm-slim` runtime (NOT distroless) so that
# native libraries used by `mongodb` / `fred` (OpenSSL, CA bundles, libcurl)
# work out of the box without bind-mounting certificates.
#
# Build with (from repo root):
#   docker build -f rust/Dockerfile -t sabnode-api:dev rust/

# ---------- Stage 1: chef base ------------------------------------------------
FROM lukemathwalker/cargo-chef:0.1.68-rust-1.83-bookworm AS chef
WORKDIR /app

# ---------- Stage 2: planner --------------------------------------------------
FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ---------- Stage 3: builder (deps cooked, then app built) --------------------
FROM chef AS builder

# System deps required to compile the workspace (TLS + protoc-less OTLP HTTP).
RUN apt-get update && apt-get install -y --no-install-recommends \
        pkg-config \
        libssl-dev \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Cook only the dependency graph — heavy and rarely changing.
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json

# Now copy the rest of the source and build the binary.
COPY . .
RUN cargo build --release --bin sabnode-api

# ---------- Stage 4: runtime --------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Runtime libs:
#   ca-certificates  — TLS to MongoDB Atlas, OTLP collector, etc.
#   libssl3          — runtime counterpart to libssl-dev used at build time.
#   libcurl4         — used transitively by some native deps (e.g. mongodb-lib).
#   tini             — proper PID-1 / signal forwarding for graceful shutdown.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
        libcurl4 \
        tini \
    && rm -rf /var/lib/apt/lists/*

# Drop privileges.
RUN groupadd --system --gid 1001 app \
    && useradd  --system --uid 1001 --gid app --home-dir /home/app --create-home app

COPY --from=builder /app/target/release/sabnode-api /usr/local/bin/sabnode-api

USER app
WORKDIR /home/app

EXPOSE 8080
ENV SABNODE_PORT=8080 \
    SABNODE_ENV=production \
    RUST_LOG=info,sabnode=debug

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/sabnode-api"]
