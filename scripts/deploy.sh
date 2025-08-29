#!/bin/bash

# Game Highlights AI - Deployment Script
set -e

echo "🚀 Starting Game Highlights AI PoC Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI not found. Please install AWS CLI first.${NC}"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    echo -e "${RED}❌ AWS CDK not found. Installing CDK...${NC}"
    npm install -g aws-cdk
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}❌ AWS credentials not configured. Please run 'aws configure' first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get AWS account and region info
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")

echo "📍 Deploying to Account: $AWS_ACCOUNT, Region: $AWS_REGION"

# Install dependencies
echo "📦 Installing dependencies..."
cd infrastructure
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Build TypeScript
echo "🔨 Building TypeScript..."
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Bootstrap CDK if needed
echo "🏗️  Checking CDK bootstrap..."
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region $AWS_REGION &> /dev/null; then
    echo "🔧 Bootstrapping CDK..."
    cdk bootstrap
    echo -e "${GREEN}✅ CDK bootstrapped${NC}"
else
    echo -e "${GREEN}✅ CDK already bootstrapped${NC}"
fi

# Check Bedrock access
echo "🧠 Checking Bedrock access..."
if aws bedrock list-foundation-models --region $AWS_REGION &> /dev/null; then
    echo -e "${GREEN}✅ Bedrock access confirmed${NC}"
else
    echo -e "${YELLOW}⚠️  Bedrock access not available. Please enable model access in AWS Console.${NC}"
    echo "   Go to: AWS Console → Bedrock → Model Access → Request Access for Anthropic Claude models"
fi

# Deploy the stack
echo "🚀 Deploying infrastructure..."
cdk deploy GameHighlightsPocStack --require-approval never

if [ $? -eq 0 ]; then
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    
    # Get stack outputs
    echo "📋 Stack Outputs:"
    aws cloudformation describe-stacks --stack-name GameHighlightsPocStack --region $AWS_REGION \
        --query 'Stacks[0].Outputs[*].[OutputKey,OutputValue]' --output table
    
    echo ""
    echo -e "${GREEN}🎯 Next Steps:${NC}"
    echo "1. Upload a test video: aws s3 cp your-video.mp4 s3://BUCKET_NAME/uploads/test-game/video.mp4"
    echo "2. Monitor processing: aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction-* --follow"
    echo "3. Check results: aws dynamodb scan --table-name GameHighlights --max-items 5"
    echo "4. Test API: curl API_URL/highlights"
    echo ""
    echo -e "${GREEN}📚 See BUILD_AND_TEST.md for detailed testing instructions${NC}"
    
else
    echo -e "${RED}❌ Deployment failed. Check the error messages above.${NC}"
    exit 1
fi