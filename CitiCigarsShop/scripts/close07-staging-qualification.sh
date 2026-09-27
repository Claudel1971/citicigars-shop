#!/usr/bin/env bash
set -euo pipefail

echo "== CLOSE-07 staging qualification =="
echo "0/4 Ensure test dependencies"
npm install --include=dev

echo "1/4 RBAC/Admin"
npx tsx scripts/close07-staging-rbac.ts

echo "2/4 CLOSE-06 real staging integration"
npx vitest run server/services/close06-interclose.integration.test.ts --reporter=verbose --testTimeout=60000

echo "3/4 Admin UI targeted regression"
npx vitest run \
  client/src/components/admin/StockAdmin.test.tsx \
  client/src/components/admin/PurchasingAdmin.test.tsx \
  client/src/components/admin/StockMonitoring.test.tsx \
  --reporter=verbose

echo "4/4 Production build"
npm run build

echo "CLOSE-07 STAGING QUALIFICATION PASS"
exit 1
