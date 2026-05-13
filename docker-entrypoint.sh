#!/bin/sh
set -e

echo "Starting deployment entrypoint..."

# Ensure the database is up to date
# We use db push for SQLite in this context to ensure schema matches
echo "Syncing database schema..."
npx prisma db push --skip-generate

# Start the application
echo "Starting application..."
exec "$@"
