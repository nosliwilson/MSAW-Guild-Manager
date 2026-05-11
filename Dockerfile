FROM node:20-slim

WORKDIR /app

# Install openssl for Prisma
RUN apt-get update -y && apt-get install -y openssl

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build frontend
RUN npm run build

# Make entrypoint executable
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENV NODE_ENV=production

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npm", "start"]
