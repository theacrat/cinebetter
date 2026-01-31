#!/bin/sh

case "$SQLITE_DB" in
  file:*) export SQLITE_DB="file:/data/$(basename "${SQLITE_DB#file:}")" ;;
esac

bun run db:deploy

exec bun dist/server/index.mjs
