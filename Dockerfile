# ============================================
# STAGE 1: Build Stage (Multi-stage build)
# ============================================
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Installe TOUTES les dépendances (y compris Vite et TypeScript)
RUN npm ci --prefer-offline --no-audit && \
    npm cache clean --force

# Copy source files
COPY src/ ./src/
COPY public/ ./public/
COPY index.html ./
COPY vite.config.ts ./
COPY postcss.config.js ./
COPY tailwind.config.js ./
COPY api.js ./

# Build the React application
RUN npm run build

# ============================================
# STAGE 2: Production Stage (Minimal runtime)
# ============================================
FROM node:20-alpine AS runtime

# Install runtime dependencies only (AVEC speedtest-cli)
RUN apk add --no-cache \
    curl \
    ca-certificates \
    iputils \
    fping \
    dumb-init \
    tini \
    bind-tools \
    speedtest-cli

# Create non-root user for security
RUN addgroup -g 1001 app && \
    adduser -D -u 1001 -G app app

WORKDIR /app

# Copy package files only
COPY package*.json ./

# Install production dependencies only
ENV NODE_ENV=production
RUN npm ci --omit=dev --prefer-offline && \
    npm install -g serve concurrently && \
    npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api.js ./api.js

# Create directories for logging and data
RUN mkdir -p /app/logs /app/data && \
    chown -R app:app /app

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3001/api/health || exit 1

# Expose ports
EXPOSE 3000 3001

# Use tini as PID 1 for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Default command: Run API and static production frontend
CMD ["concurrently", "\"node api.js\"", "\"serve -s dist -l 3000\""]

# ============================================
# Build metadata
# ============================================
LABEL maintainer="DevOps Team"
LABEL description="MEDIAHUB Dashboard - Real-time Monitoring with Docker & Tailscale"
LABEL version="1.0.0"