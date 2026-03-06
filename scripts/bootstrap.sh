#!/bin/bash

# CDK Bootstrap Script
# Usage: ./scripts/bootstrap.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bootstrapping CDK in AWS Account${NC}"
echo -e "${GREEN}========================================${NC}"

# Load environment variables
if [ -f ".env.local" ]; then
  echo -e "${YELLOW}Loading environment variables from .env.local${NC}"
  export $(cat .env.local | xargs)
fi

ACCOUNT_ID=${AWS_ACCOUNT_ID:-637404140637}
REGION=${AWS_REGION:-us-east-1}

echo -e "${YELLOW}Account: $ACCOUNT_ID${NC}"
echo -e "${YELLOW}Region: $REGION${NC}"

# Navigate to CDK directory
cd cdk

# Bootstrap CDK
echo -e "${GREEN}Bootstrapping CDK...${NC}"
npx cdk bootstrap aws://$ACCOUNT_ID/$REGION

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Bootstrap complete!${NC}"
echo -e "${GREEN}========================================${NC}"
