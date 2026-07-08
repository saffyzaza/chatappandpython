#!/bin/bash
# Creates additional databases listed in POSTGRES_MULTIPLE_DATABASES
# e.g. POSTGRES_MULTIPLE_DATABASES=accident_db,chat-aio
# The first DB is already created by POSTGRES_DB; this script creates the rest.

set -e

function create_db() {
    local db=$1
    echo "Creating database '$db' if it does not exist..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        SELECT 'CREATE DATABASE "$db"'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
EOSQL
}

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple databases requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
        if [ "$db" != "$POSTGRES_DB" ]; then
            create_db "$db"
        fi
    done
    echo "Multiple databases created."
fi
