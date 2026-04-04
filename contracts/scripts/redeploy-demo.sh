#!/bin/bash
# Run this before each live demo to get fresh nullifiers
# Usage: cd contracts && bash scripts/redeploy-demo.sh

set -e

# Increment version
VERSION="v$(date +%s)"
echo "Deploying with action: verify-agent-$VERSION"

# Update action in deploy script
sed -i '' "s/const action = \"verify-agent-.*\"/const action = \"verify-agent-$VERSION\"/" scripts/deploy.ts

# Update action in app
sed -i '' "s/\"verify-agent-[^\"]*\"/\"verify-agent-$VERSION\"/g" ../app/app/page.tsx
sed -i '' "s/\"verify-agent-[^\"]*\"/\"verify-agent-$VERSION\"/g" ../app/app/widget/page.tsx

# Deploy
npx hardhat run scripts/deploy.ts --network worldChain

echo ""
echo "Now update .env with the new addresses above and restart the app."
echo "On Vercel: push to git and update env vars."
