# Build and Test Guide

## Prerequisites

### 1. AWS Setup
```bash
# Install AWS CLI if not already installed
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Configure AWS credentials
aws configure
# Enter your Access Key ID, Secret Access Key, Region (us-east-1), and output format (json)

# Verify AWS access
aws sts get-caller-identity
```

### 2. Node.js and CDK Setup
```bash
# Install Node.js (if not already installed)
# Download from https://nodejs.org/ or use homebrew:
brew install node

# Install AWS CDK globally
npm install -g aws-cdk

# Verify CDK installation
cdk --version
```

### 3. Enable Required AWS Services
```bash
# Enable Bedrock model access (one-time setup)
aws bedrock list-foundation-models --region us-east-1

# If you get access denied, request access to Claude models in AWS Console:
# Go to AWS Bedrock Console → Model Access → Request Access for Anthropic Claude models
```

## Build Process

### Step 1: Install Dependencies
```bash
# From project root
cd infrastructure
npm install

# Verify TypeScript compilation
npm run build
```

### Step 2: Bootstrap CDK (First Time Only)
```bash
# Bootstrap CDK in your AWS account/region
cdk bootstrap

# This creates the necessary S3 bucket and IAM roles for CDK deployments
```

### Step 3: Review and Deploy Infrastructure
```bash
# Preview what will be deployed
cdk diff

# Deploy the PoC stack
cdk deploy GameHighlightsPocStack

# Confirm deployment when prompted (type 'y')
```

### Step 4: Note the Outputs
After deployment, save these important outputs:
- `VideoBucketName`: For uploading test videos
- `HighlightsBucketName`: Where processed highlights are stored
- `ApiUrl`: REST API endpoint
- `CloudFrontUrl`: CDN URL for accessing highlights
- `WebSocketUrl`: For real-time updates

## Testing the System

### Test 1: Basic Infrastructure Verification
```bash
# Check if Lambda functions are deployed
aws lambda list-functions --query 'Functions[?contains(FunctionName, `GameHighlights`)].FunctionName'

# Check if DynamoDB tables exist
aws dynamodb list-tables --query 'TableNames[?contains(@, `Game`)]'

# Check if S3 buckets exist
aws s3 ls | grep game-highlights
```

### Test 2: Upload Test Video
```bash
# Create a test video file (or use existing gaming footage)
# For testing, you can use any MP4 file

# Upload to the video bucket (replace BUCKET_NAME with actual bucket name)
aws s3 cp test-video.mp4 s3://BUCKET_NAME/uploads/test-game-1/gameplay.mp4

# This should trigger the processing pipeline automatically
```

### Test 3: Monitor Processing
```bash
# Check CloudWatch logs for the video analysis function
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/GameHighlightsPocStack-VideoAnalysis"

# Get recent log events (replace LOG_GROUP_NAME)
aws logs filter-log-events --log-group-name LOG_GROUP_NAME --start-time $(date -d '10 minutes ago' +%s)000
```

### Test 4: Check Results in DynamoDB
```bash
# Scan the highlights table to see generated highlights
aws dynamodb scan --table-name GameHighlights --max-items 5

# Check if highlights were created
aws dynamodb query --table-name GameHighlights --key-condition-expression "highlightId = :hid" --expression-attribute-values '{":hid":{"S":"test-game-1-TIMESTAMP-0"}}'
```

### Test 5: Test API Endpoints
```bash
# Test the highlights API (replace API_URL with actual URL)
curl "API_URL/highlights"

# Test user preferences API
curl -X POST "API_URL/users/test-user-1/preferences" \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-1","preferences":[{"type":"SPORT","value":"soccer","weight":5}]}'
```

## Advanced Testing

### Test 6: Create Sample User Data
```bash
# Add test users to DynamoDB
aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "demo-user-1"},
  "preferences": {"L": [
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "soccer"}, "weight": {"N": "5"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "goal"}, "weight": {"N": "10"}}}
  ]}
}'

aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "demo-user-2"},
  "preferences": {"L": [
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "basketball"}, "weight": {"N": "8"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "dunk"}, "weight": {"N": "9"}}}
  ]}
}'
```

### Test 7: Manual Lambda Function Testing
```bash
# Test video analysis function directly
aws lambda invoke --function-name GameHighlightsPocStack-VideoAnalysisFunction-XXXXX \
  --payload '{"bucket":"BUCKET_NAME","key":"uploads/test-game-1/gameplay.mp4"}' \
  response.json

cat response.json
```

### Test 8: Step Functions Workflow Testing
```bash
# Start a Step Functions execution manually
aws stepfunctions start-execution \
  --state-machine-arn "WORKFLOW_ARN" \
  --input '{"bucket":"BUCKET_NAME","key":"uploads/test-game-1/gameplay.mp4","gameId":"test-game-1"}'

# Check execution status
aws stepfunctions list-executions --state-machine-arn "WORKFLOW_ARN" --max-items 5
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Bedrock Access Denied
```bash
# Check if you have access to Bedrock models
aws bedrock list-foundation-models --region us-east-1

# If access denied, go to AWS Console → Bedrock → Model Access and request access
```

#### 2. Lambda Function Timeout
```bash
# Check CloudWatch logs for timeout errors
aws logs filter-log-events --log-group-name "/aws/lambda/FUNCTION_NAME" --filter-pattern "Task timed out"

# Increase timeout in CDK and redeploy if needed
```

#### 3. S3 Permissions Issues
```bash
# Check bucket policy and IAM roles
aws s3api get-bucket-policy --bucket BUCKET_NAME
aws iam get-role --role-name ROLE_NAME
```

#### 4. DynamoDB Issues
```bash
# Check table status
aws dynamodb describe-table --table-name GameHighlights

# Check for throttling
aws logs filter-log-events --log-group-name "/aws/lambda/FUNCTION_NAME" --filter-pattern "ProvisionedThroughputExceededException"
```

## Performance Testing

### Load Testing Script
```bash
#!/bin/bash
# upload-multiple-videos.sh

BUCKET_NAME="your-video-bucket-name"
VIDEO_FILE="test-video.mp4"

for i in {1..5}; do
  echo "Uploading video $i..."
  aws s3 cp $VIDEO_FILE s3://$BUCKET_NAME/uploads/load-test-$i/gameplay.mp4
  sleep 30  # Wait 30 seconds between uploads
done

echo "Load test complete. Check CloudWatch for processing metrics."
```

### Monitoring Commands
```bash
# Monitor Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=GameHighlightsPocStack-VideoAnalysisFunction-XXXXX \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum

# Monitor DynamoDB read/write capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=GameHighlights \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Demo Preparation

### Quick Demo Setup
```bash
# 1. Deploy infrastructure
npm run deploy

# 2. Upload sample videos
aws s3 cp demo-soccer.mp4 s3://BUCKET/uploads/demo-soccer/game.mp4
aws s3 cp demo-basketball.mp4 s3://BUCKET/uploads/demo-basketball/game.mp4

# 3. Create demo users
# (Use the DynamoDB commands from Test 6 above)

# 4. Wait for processing (5-10 minutes)

# 5. Test API endpoints
curl "API_URL/highlights"
```

### Real-Time Demo Monitoring
```bash
# Watch logs in real-time during demo
aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction-XXXXX --follow

# Monitor Step Functions executions
watch -n 5 'aws stepfunctions list-executions --state-machine-arn WORKFLOW_ARN --max-items 3'
```

## Cleanup

### Remove All Resources
```bash
# Delete the CDK stack (removes all resources)
cdk destroy GameHighlightsPocStack

# Confirm deletion when prompted
```

### Selective Cleanup
```bash
# Empty S3 buckets before deletion (if needed)
aws s3 rm s3://BUCKET_NAME --recursive

# Delete specific resources if needed
aws dynamodb delete-table --table-name GameHighlights
```

This guide provides everything you need to build, deploy, and thoroughly test your Game Highlights AI PoC for the AWS Summit demo!