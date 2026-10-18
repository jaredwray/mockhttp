# Use an official Node.js image as the base
FROM node:24.21.0-alpine3.24@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1

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