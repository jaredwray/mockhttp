# Use an official Node.js image as the base
FROM node:24.20.0-alpine3.24@sha256:e67514e5d0f6c46656005e1b693b2ec9d52e80b641307de684d4a015ba7a4eaf

# Set working directory
WORKDIR /app

# Copy files from build context to the container
COPY --chown=node:node node_modules/ ./node_modules/
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node public/ ./public/
COPY --chown=node:node dist/ ./dist/
COPY --chown=node:node site/dist/ ./site/dist/

# Switch to non-root user
USER node

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.mjs"]