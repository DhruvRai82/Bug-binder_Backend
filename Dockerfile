FROM node:20

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (including Playwright)
RUN npm install

# Install Playwright Browsers and System Dependencies
# We stick to Chromium for now to keep image size reasonable, but can add others if needed
RUN npx playwright install chromium
RUN npx playwright install-deps chromium

# Copy source code
COPY . .

# Expose port
EXPOSE 5000

# Start command
CMD ["npm", "run", "dev"]
