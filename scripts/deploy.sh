#!/bin/bash

# CDK Deployment Script
# Usage: ./scripts/deploy.sh [dev|staging|prod]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get stage from argument or default to dev
STAGE=${1:-dev}

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
  echo -e "${RED}Error: Invalid stage '$STAGE'. Must be dev, staging, or prod.${NC}"
  exit 1
fi

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deploying to stage: $STAGE${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f ".env.$STAGE" ]; then
  echo -e "${YELLOW}Loading environment variables from .env.$STAGE${NC}"
  export $(cat .env.$STAGE | xargs)
fi

# Navigate to CDK directory
cd cdk

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}Installing CDK dependencies...${NC}"
  npm install
fi

# Build TypeScript
echo -e "${YELLOW}Building CDK app...${NC}"
npm run build

# Show diff
echo -e "${YELLOW}Showing changes...${NC}"
npx cdk diff --context stage=$STAGE

# Ask for confirmation
read -p "Do you want to deploy these changes? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo -e "${RED}Deployment cancelled.${NC}"
  exit 1
fi

# Deploy
echo -e "${GREEN}Deploying stacks...${NC}"
npx cdk deploy --all --context stage=$STAGE --require-approval never

# Post-deployment validation
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Show outputs
echo -e "${YELLOW}Stack outputs:${NC}"
npx cdk deploy --all --context stage=$STAGE --outputs-file ../cdk-outputs-$STAGE.json

echo -e "${GREEN}Outputs saved to cdk-outputs-$STAGE.json${NC}"
