#!/bin/bash
set -e

if [[ "${NODE_ENV:-development}" == "production" ]]; then
  echo "Refusing to run development schema setup in production."
  exit 1
fi
if [[ -z "${REPLIT_DEV_DOMAIN:-}" || -n "${REPLIT_DEPLOYMENT:-}" ]]; then
  echo "Refusing to run development schema setup outside a Replit development workspace."
  exit 1
fi
export NODE_ENV=development

echo "==> Installing dependencies..."
npm install --legacy-peer-deps

echo "==> Applying available development SQL migrations..."
npm run db:sync:dev -- --defer-missing-schema

echo "==> Pushing DB schema changes..."
npm run db:push

echo "==> Applying remaining development SQL migrations..."
npm run db:sync:dev

echo "==> Post-merge setup complete."
