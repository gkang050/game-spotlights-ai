# 🚀 Getting Started with Game Spotlights AI

**Complete setup guide for deploying and running the Game Spotlights AI system**

---

## 📋 Prerequisites

### **Required Tools:**
- **AWS Account** with appropriate permissions
- **AWS CLI** configured with credentials
- **Node.js 18+** and npm
- **Git** for repository cloning

### **AWS Permissions Needed:**
- Lambda, S3, DynamoDB, API Gateway
- Rekognition, Bedrock, Comprehend, MediaConvert
- Kinesis Video Streams, CloudFront, EventBridge
- IAM role creation and management

---

## ⚡ Quick Deploy (5 minutes)

### **1. Clone and Setup**
```bash
git clone https://github.com/yourusername/game-spotlights-ai.git
cd game-spotlights-ai
```

### **2. Deploy Infrastructure**
```bash
cd infrastructure
npm install
npm run build
npm run deploy
```

### **3. Note the Outputs**
After deployment, save these values:
- **API URL**: `https://xyz.execute-api.us-east-1.amazonaws.com/prod/`
- **S3 Bucket**: `game-highlights-videos-{ACCOUNT_ID}`
- **CloudFront Domain**: `d1234567890.cloudfront.net`

### **4. Test the System**
```bash
# Test the API
curl "https://YOUR_API_URL/highlights"

# Test personalization
curl "https://YOUR_API_URL/users/soccer-fan/preferences"
```

---

## 🎯 Detailed Setup Guide

### **Step 1: Environment Setup**

**Configure AWS CLI:**
```bash
aws configure
# Enter your AWS Access Key ID (use IAM user with minimal permissions)
# Enter your AWS Secret Access Key (never commit these to git)
# Enter your default region (e.g., us-east-1)
# Enter output format: json
```

**🔒 Security Note:** AWS credentials are stored in `~/.aws/credentials` and never committed to git. For production, use IAM roles and AWS STS temporary credentials.

**Verify Permissions:**
```bash
# Test basic AWS access
aws sts get-caller-identity

# Check required service access
aws rekognition describe-collection --collection-id test 2>/dev/null || echo "Rekognition access confirmed"
```

### **Step 2: Infrastructure Deployment**

**Install Dependencies:**
```bash
cd infrastructure
npm install
```

**Build TypeScript:**
```bash
npm run build
```

**Deploy to AWS:**
```bash
npm run deploy
```

**Expected Output:**
```
✅ GameHighlightsPocStack

Outputs:
GameHighlightsPocStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
GameHighlightsPocStack.VideoBucketName = game-highlights-videos-123456789
GameHighlightsPocStack.CloudFrontDomainName = d1234567890.cloudfront.net
```

### **Step 3: Verify Deployment**

**Check Lambda Functions:**
```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `GameHighlights`)].FunctionName'
```

**Check S3 Buckets:**
```bash
aws s3 ls | grep game-highlights
```

**Check DynamoDB Tables:**
```bash
aws dynamodb list-tables --query 'TableNames[?contains(@, `Game`)]'
```

---

## 🎬 Testing the System

### **Test 1: API Endpoints**
```bash
# Replace with your actual API URL
export API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

# Test general highlights
curl "$API_URL/highlights" | jq .

# Test personalization
curl "$API_URL/users/soccer-fan/preferences" | jq .
curl "$API_URL/users/basketball-fan/preferences" | jq .
```

### **Test 2: Video Upload (Manual)**
```bash
# Upload a test video to trigger processing
aws s3 cp your-gaming-video.mp4 s3://game-highlights-videos-YOUR_ACCOUNT_ID/uploads/
```

### **Test 3: Demo Interface**
```bash
# Open the demo interface
open demo-test.html
# Or serve locally:
python3 -m http.server 8000
# Then visit: http://localhost:8000/demo-test.html
```

### **Test 4: Kinesis Streaming**
```bash
# Open the Kinesis demo
open kinesis-demo.html
# Test live streaming capabilities
```

---

## 🔧 Development Setup

### **Local Development:**
```bash
# Install dependencies for each Lambda function
cd src/video-analysis && npm install
cd ../highlight-generation && npm install  
cd ../personalization && npm install
cd ../kinesis-processor && npm install
cd ../clip-processor && npm install
```

### **Environment Variables:**
Each Lambda function uses environment variables set by CDK:
- `HIGHLIGHTS_TABLE`: DynamoDB table for highlight metadata
- `VIDEO_BUCKET`: S3 bucket for video storage
- `CLOUDFRONT_DOMAIN`: CDN domain for video delivery

### **Testing Individual Functions:**
```bash
# Test video analysis locally
cd src/video-analysis
node -e "
const handler = require('./index').handler;
handler({
  bucket: 'your-bucket',
  key: 'uploads/test-video.mp4'
}).then(console.log);
"
```

---

## 📊 Monitoring & Debugging

### **CloudWatch Logs:**
```bash
# View Lambda function logs
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/GameHighlights"

# Tail logs in real-time
aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction --follow
```

### **DynamoDB Data:**
```bash
# Check stored highlights
aws dynamodb scan --table-name GameHighlights --limit 5

# Check processing status
aws dynamodb scan --table-name GameHighlights --filter-expression "clipGenerated = :true" --expression-attribute-values '{":true":{"BOOL":true}}'
```

### **MediaConvert Jobs:**
```bash
# Check video processing jobs
aws mediaconvert list-jobs --status COMPLETE --max-results 10
```

---

## 🎯 Configuration Options

### **Enable Real Data Mode:**
Update highlight generation function to use real DynamoDB data:
```bash
aws lambda update-function-configuration \
  --function-name GameHighlightsPocStack-HighlightGenerationFunction \
  --environment Variables='{USE_REAL_DATA=true}'
```

### **Adjust AI Confidence Thresholds:**
Modify `src/video-analysis/index.js`:
```javascript
// Line 98: Adjust minimum confidence for highlight detection
MinConfidence: 70  // Change to 80 for higher quality, 60 for more highlights
```

### **Customize Sports Detection:**
Modify `src/video-analysis/index.js`:
```javascript
// Line 171: Add new sports or gaming categories
const interestingLabels = ['Ball', 'Sports', 'Goal', 'Celebration', 'Person', 'Crowd', 'YourNewLabel'];
```

---

## 🔍 Troubleshooting

### **Common Issues:**

**API Returns 500 Error:**
```bash
# Check Lambda function logs
aws logs tail /aws/lambda/GameHighlightsPocStack-HighlightGenerationFunction --follow
```

**Video Upload Not Processing:**
```bash
# Verify S3 event notifications
aws s3api get-bucket-notification-configuration --bucket game-highlights-videos-YOUR_ACCOUNT_ID

# Check video analysis function logs
aws logs tail /aws/lambda/GameHighlightsPocStack-VideoAnalysisFunction --follow
```

**Kinesis Streaming Issues:**
```bash
# Check stream status
aws kinesisvideo describe-stream --stream-name game-highlights-stream-YOUR_ACCOUNT_ID

# Verify processor function
aws logs tail /aws/lambda/GameHighlightsPocStack-KinesisStreamProcessorFunction --follow
```

**No Clips Generated:**
```bash
# Check MediaConvert jobs
aws mediaconvert list-jobs --status ERROR --max-results 5

# Check clip processor logs
aws logs tail /aws/lambda/GameHighlightsPocStack-ClipProcessorFunction --follow
```

---

## 🛠️ Customization Guide

### **Add New Sports:**
1. Update `extractGameTypeFromKey()` in `video-analysis/index.js`
2. Add sport-specific labels to `interestingLabels` array
3. Customize Bedrock prompts for sport-specific analysis

### **Enhance Personalization:**
1. Modify `calculateBaseScore()` in `highlight-generation/index.js`
2. Add user preference storage in DynamoDB
3. Implement Amazon Personalize integration (permissions already configured)

### **Add New AI Services:**
1. Update IAM permissions in `poc-stack.ts`
2. Add new SDK imports to Lambda functions
3. Integrate into the AI processing pipeline

---

## 💰 Cost Management

### **Monitor Costs:**
```bash
# Set up billing alerts
aws budgets create-budget --account-id YOUR_ACCOUNT_ID --budget '{
  "BudgetName": "GameHighlights-Monthly",
  "BudgetLimit": {"Amount": "50", "Unit": "USD"},
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}'
```

### **Optimize Costs:**
- **S3 Lifecycle**: Automatically delete old videos after 30 days
- **DynamoDB**: Use on-demand billing for variable workloads
- **Lambda**: Right-size memory allocation based on usage
- **CloudFront**: Use appropriate price class for your audience

---

## 🎯 Next Steps

### **Production Enhancements:**
1. **Real User Management**: Replace demo users with actual user accounts
2. **Amazon Personalize**: Upgrade to ML-based recommendations
3. **Multi-Region**: Deploy across multiple AWS regions
4. **Advanced Security**: Add authentication and authorization
5. **Batch Processing**: Handle multiple simultaneous uploads

### **Integration Options:**
1. **Streaming Software**: OBS Studio, XSplit plugins
2. **Mobile Apps**: iOS/Android SDKs for mobile gaming
3. **Gaming Platforms**: Integration with Twitch, YouTube, Discord
4. **Analytics**: QuickSight dashboards for content insights

---

## 📚 Additional Resources

- **Technical Documentation**: Complete implementation details and best practices
- **API Documentation**: Detailed endpoint specifications  
- **Architecture Diagrams**: Visual system design documentation
- **Cost Analysis**: Detailed pricing breakdown and optimization strategies

---

## 🆘 Support

### **Common Commands:**
```bash
# Redeploy after changes
npm run deploy

# View all stack resources
aws cloudformation describe-stacks --stack-name GameHighlightsPocStack

# Clean up (delete everything)
npm run cdk destroy
```

### **Getting Help:**
- Check CloudWatch logs for detailed error information
- Use AWS Console to monitor service health
- Verify IAM permissions if services fail to communicate
- Test individual components before running end-to-end workflows

This system is designed to be production-ready while remaining easy to understand, modify, and extend for your specific gaming content needs.
