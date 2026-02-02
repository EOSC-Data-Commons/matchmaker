# Base image with dependencies
FROM node:24-alpine AS base

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (needed for both dev and build)
RUN npm ci

# Development stage
FROM base AS development

WORKDIR /app

# Copy only necessary config files for dev
# Source files will be mounted as volumes
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY eslint.config.js ./
COPY index.html ./

# Expose development port
EXPOSE 5173

# Start development server
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build

WORKDIR /app

# Copy source code
COPY . .

# Build the application (client + server)
RUN npm run build

# Production stage
FROM node:24-alpine AS production

WORKDIR /app

# Copy package files for production dependencies
COPY package.json package-lock.json* ./

# Install only production dependencies (tsx no longer needed)
RUN npm ci --omit=dev

# Copy built artifacts from build stage
COPY --from=build /app/dist ./dist

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the compiled server (no tsx required)
CMD ["node", "dist/server.prod.js"]
