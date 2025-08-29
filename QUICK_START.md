# 🚀 Quick Start Guide

Get your Game Highlights AI PoC running in minutes!

## Prerequisites (5 minutes)

1. **AWS Account Setup**
   ```bash
   # Install AWS CLI (if not installed)
   curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
   sudo installer -pkg AWSCLIV2.pkg -target /
   
   # Configure credentials
   aws configure
   ```

2. **Node.js & CDK**
   ```bash
   # Install Node.js from https://nodejs.org/
   # Or use homebrew:
   brew install node
   
   # Install CDK
   npm install -g aws-cdk
   ```

3. **Enable Bedrock (Important!)**
   - Go to AWS Console → Bedrock → Model Access
   - Request access to "Anthropic Claude" models
   - This is required for AI enhancement features

## One-Command Deployment

```bash
# Deploy everything and create demo data
npm run quick-start
```

This single command will:
- ✅ Deploy all AWS infrastructure
- ✅ Create sample users and highlights
- ✅ Run system tests
- ✅ Provide demo instructions

## Manual Step-by-Step

If you prefer manual control:

### Step 1: Deploy Infrastructure
```bash
npm run deploy
```

### Step 2: Create Demo Data
```bash
npm run demo-data
```

### Step 3: Test the System
```bash
npm run test
```

## Verify Everything Works

### Check API Endpoints
```bash
# Get stack outputs first
aws cloudformation describe-stacks --stack-name GameHighlightsPocStack --query 'Stacks[0].Outputs'

# Test highlights API (replace API_URL)
curl "API_URL/highlights"

# Test personalization (replace API_URL)
curl "API_URL/users/soccer-fan/preferences"
```

### Check Demo Data
```bash
# View created users
aws dynamodb scan --table-name GameUsers --max-items 5

# View sample highlights
aws dynamodb scan --table-name GameHighlights --max-items 5
```

## Upload Test Video

```bash
# Get video bucket name
VIDEO_BUCKET=$(aws cloudformation describe-stacks --stack-name GameHighlightsPocStack --query 'Stacks[0].Outputs[?OutputKey==`VideoBucketName`].OutputValue' --output text)

# Upload any MP4 file
aws s3 cp your-video.mp4 s3://$VIDEO_BUCKET/uploads/test-game/gameplay.mp4

# Monitor processing (takes 2-5 minutes)
aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction-* --follow
```

## Demo Scenarios

### 1. Show Personalization Differences
```bash
# Soccer fan gets soccer highlights
curl "API_URL/users/soccer-fan/preferences"

# Basketball fan gets basketball highlights  
curl "API_URL/users/basketball-fan/preferences"

# General fan gets mixed content
curl "API_URL/users/general-fan/preferences"
```

### 2. Show AI Enhancement
```bash
# View AI-enhanced metadata
aws dynamodb get-item --table-name GameHighlights --key '{"highlightId":{"S":"demo-soccer-goal-1"},"timestamp":{"S":"TIMESTAMP"}}'
```

### 3. Show Real-Time Processing
```bash
# Upload video and watch logs in real-time
aws s3 cp demo-video.mp4 s3://$VIDEO_BUCKET/uploads/live-demo/game.mp4
aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction-* --follow
```

## Troubleshooting

### Common Issues

**❌ Bedrock Access Denied**
- Solution: Enable model access in AWS Console → Bedrock → Model Access

**❌ CDK Bootstrap Error**
- Solution: `cdk bootstrap` in the infrastructure directory

**❌ Lambda Timeout**
- Solution: Check CloudWatch logs for specific errors

**❌ API Returns Empty Results**
- Solution: Wait for demo data creation to complete (~1 minute)

### Get Help
```bash
# Check deployment status
aws cloudformation describe-stacks --stack-name GameHighlightsPocStack

# View recent errors
aws logs filter-log-events --log-group-name /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction-* --start-time $(date -d '10 minutes ago' +%s)000

# Test individual components
npm run test
```

## Clean Up

```bash
# Remove all resources
npm run destroy
```

## What's Included

### 🏗️ **Infrastructure**
- S3 buckets for video storage
- DynamoDB tables for metadata
- Lambda functions for processing
- Step Functions workflow
- API Gateway for REST endpoints
- CloudFront for content delivery

### 🤖 **AI/ML Services**
- **Amazon Rekognition**: Video analysis and object detection
- **Amazon Bedrock**: AI-powered content understanding
- **Enhanced Personalization**: Multi-algorithm recommendation engine

### 📊 **Demo Data**
- 4 user profiles with different preferences
- 4 sample highlights with AI metadata
- Test scenarios for personalization demo

### 🔧 **Monitoring & Testing**
- CloudWatch logs integration
- Real-time processing monitoring
- API endpoint testing
- System health checks

## Next Steps

1. **Customize for Your Demo**: Modify user preferences and highlight types
2. **Add Real Videos**: Upload actual gaming footage for processing
3. **Extend AI Features**: Add more Bedrock models or custom ML
4. **Scale Up**: Configure auto-scaling and production settings

## 🎯 Ready for AWS Summit LA!

Your PoC demonstrates:
- ✅ Real-time video processing with AI
- ✅ Personalized content recommendations  
- ✅ Serverless, scalable architecture
- ✅ Multiple AWS AI/ML services integration
- ✅ Production-ready patterns and best practices

**Total setup time: ~10-15 minutes** ⚡