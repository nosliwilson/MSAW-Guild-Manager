#!/bin/sh

# Ensure the database is in sync with the schema
# This will create the database if it doesn't exist
# and add missing tables/columns if it does.
echo "Syncing database schema..."
npx prisma db push --skip-generate

# Start the application
exec "$@"
