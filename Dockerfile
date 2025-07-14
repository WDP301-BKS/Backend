# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY .env.docker ./.env

# Create necessary directories
RUN mkdir -p logs uploads

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S football -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R football:nodejs /app

# Switch to non-root user
USER football

# Expose port
EXPOSE 5001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 5001, path: '/api/health', timeout: 5000 }; \
    const req = http.request(options, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); \
    req.on('error', () => process.exit(1)); \
    req.end();"

# Start the application
CMD ["node", "src/index.js"]
