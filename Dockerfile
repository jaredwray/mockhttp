# Use an official Node.js image as the base
FROM node:24.22.3-alpine3.24@sha256:98e4e60b35fd50143e1838da2957488c25aa3a3efbd48bb679923f77d6d3d873

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