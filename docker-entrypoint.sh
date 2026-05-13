#!/bin/sh
set -e

echo "Starting deployment entrypoint..."

DB_FILE="guild.db"

# Check if database is malformed using sqlite3 if available, or a simple prisma check
if [ -f "$DB_FILE" ]; then
    echo "Checking database integrity..."
    # If prisma db push fails with malformed error, we rename the bad DB
    if ! npx prisma db push --skip-generate > /tmp/prisma_push_output 2>&1; then
        if grep -q "malformed" /tmp/prisma_push_output; then
            echo "CRITICAL: Database corruption detected in entrypoint!"
            BAK_FILE="$DB_FILE.malformed.$(date +%s)"
            mv "$DB_FILE" "$BAK_FILE"
            echo "Corrupted database moved to $BAK_FILE. Starting with a fresh database."
            npx prisma db push --skip-generate
        else
            cat /tmp/prisma_push_output
            exit 1
        fi
    else
        echo "Database schema synced successfully."
    fi
else
    echo "Database file missing. Initializing fresh schema..."
    npx prisma db push --skip-generate
fi

# Start the application
echo "Starting application..."
exec "$@"
