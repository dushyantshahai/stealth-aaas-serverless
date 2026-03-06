#!/bin/bash

# Deploy API Gateway with routes
# This script ensures a clean deployment of the API Gateway with all routes

set -e

STAGE=${1:-dev}

echo "🚀 Deploying API Gateway for stage: $STAGE"
echo ""

# Navigate to CDK directory
cd "$(dirname "$0")/cdk"

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔨 Building CDK app..."
npm run build

echo ""
echo "🔍 Synthesizing CloudFormation templates..."
npx cdk synth --context stage=$STAGE

echo ""
echo "🚀 Deploying stacks..."
npx cdk deploy --all --context stage=$STAGE --require-approval never

echo ""
echo "✅ Deployment complete!"
echo ""
echo "To test the API, run:"
echo "  node ../test-content-apis.js"
