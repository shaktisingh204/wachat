# syntax=docker/dockerfile:1.7

# ---- Stage 1: builder ----
FROM rust:1.82-bookworm AS builder

WORKDIR /app

# Copy manifests first so dependency layers can be cached when only src changes.
COPY Cargo.toml ./
COPY Cargo.lock* ./

# Copy sources.
COPY src ./src

# Build the release binary.
RUN cargo build --release --bin sabwa-engine

# ---- Stage 2: runtime ----
FROM debian:bookworm-slim AS runtime

# Install runtime deps (TLS certs for outbound HTTPS to Mongo Atlas / webhooks).
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user.
RUN groupadd --system --gid 1001 sabwa \
    && useradd  --system --uid 1001 --gid sabwa --create-home --home-dir /home/sabwa sabwa

WORKDIR /app

# Copy the binary from the builder stage.
COPY --from=builder /app/target/release/sabwa-engine /usr/local/bin/sabwa-engine

# Drop privileges.
USER sabwa

EXPOSE 4001

CMD ["sabwa-engine"]
