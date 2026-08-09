#!/bin/bash
set -e

echo "==> Installing dependencies..."
npm install --legacy-peer-deps

echo "==> Pushing DB schema changes..."
npm run db:push

echo "==> Post-merge setup complete."
