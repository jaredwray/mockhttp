# Use an official Node.js image as the base
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy files from build context to the container
COPY --chown=node:node node_modules/ ./node_modules/
COPY --chown=node:node package.json ./package.json
COPY --chown=node:node public/ ./public/
COPY --chown=node:node dist/ ./dist/

# Switch to non-root user
USER node

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]