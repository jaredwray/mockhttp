# Use an official Node.js image as the base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy files from build context to the container
COPY node_modules/ ./node_modules/
COPY package.json ./package.json
COPY public/ ./public/
COPY dist/ ./dist/


# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]