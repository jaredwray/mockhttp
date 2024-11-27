# Use an official Node.js image as the base
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY dist/ ./dist/
COPY public/ ./public/

# Remove the source files
RUN rm -rf src

# Expose the port the app will run on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]