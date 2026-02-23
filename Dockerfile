# Base image with dependencies
FROM node:24-alpine AS base

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies
RUN npm ci

# Development stage
FROM base AS development

WORKDIR /app

COPY . .

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

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built artifacts from build stage
COPY --from=build /app/build ./build

# Expose the port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the compiled server
CMD ["npm", "run", "prod"]
