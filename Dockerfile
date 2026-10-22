# Use an official Node.js image as the base
FROM node:24.22.1-alpine3.24@sha256:feb76650b7195319268c59cb2d419c732d6c499b13bf5296f16ab59eb1f0a4f3

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