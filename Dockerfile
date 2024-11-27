# Use an official Node.js image as the base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY public/ ./public/
COPY src/ ./src/

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Remove the source files
RUN rm -rf src

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]