FROM node:24-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application (client + server)
RUN npm run build

# Production image
FROM node:24-alpine AS production

WORKDIR /app

# Copy package files for production dependencies
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts
COPY --from=build /app/dist ./dist

# Copy the production server
COPY --from=build /app/server.prod.ts ./server.prod.ts

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the SSR server
CMD ["npx", "tsx", "server.prod.ts"]
