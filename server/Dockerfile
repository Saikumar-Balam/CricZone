
# Stage 1: Install production dependencies
FROM node:22-bookworm-slim

# Application directory
WORKDIR /app

# Install dependencies first for better Docker layer caching
COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

# Copy backend application
COPY --chown=node:node . .

# Run as non-root user
USER node

# Application configuration
ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

# Start CricZone backend
CMD ["npm", "start"]
