#!/bin/bash

if [ -z "$1" ]; then
  echo "Usage: pnpm db:migrate:local <migration_name>"
  echo "Example: pnpm db:migrate:local 20250130103923_initialize"
  echo ""
  echo "Available migrations:"
  ls -1 packages/prisma/migrations/ | grep -v migration_lock
  exit 1
fi

wrangler d1 execute freee-line-db \
  --file packages/prisma/migrations/$1/migration.sql \
  --local \
  --config apps/server/wrangler.toml
