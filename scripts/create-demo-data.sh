#!/bin/bash

# Game Highlights AI - Demo Data Creation Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🎬 Creating Demo Data for Game Highlights AI${NC}"

# Get stack outputs
STACK_OUTPUTS=$(aws cloudformation describe-stacks --stack-name GameHighlightsPocStack --query 'Stacks[0].Outputs')
VIDEO_BUCKET=$(echo $STACK_OUTPUTS | jq -r '.[] | select(.OutputKey=="VideoBucketName") | .OutputValue')

echo "📋 Using Video Bucket: $VIDEO_BUCKET"

# Create diverse user profiles for demo
echo ""
echo -e "${BLUE}👥 Creating Demo User Profiles${NC}"

# Soccer fan user
echo "Creating soccer fan user..."
aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "soccer-fan"},
  "name": {"S": "Alex Soccer Fan"},
  "preferences": {"L": [
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "soccer"}, "weight": {"N": "10"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "goal"}, "weight": {"N": "10"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "save"}, "weight": {"N": "8"}}},
    {"M": {"type": {"S": "TEAM"}, "value": {"S": "Barcelona"}, "weight": {"N": "9"}}}
  ]},
  "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
}' > /dev/null

# Basketball fan user
echo "Creating basketball fan user..."
aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "basketball-fan"},
  "name": {"S": "Jordan Basketball Fan"},
  "preferences": {"L": [
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "basketball"}, "weight": {"N": "10"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "dunk"}, "weight": {"N": "10"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "three_pointer"}, "weight": {"N": "9"}}},
    {"M": {"type": {"S": "TEAM"}, "value": {"S": "Lakers"}, "weight": {"N": "8"}}}
  ]},
  "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
}' > /dev/null

# General sports fan
echo "Creating general sports fan user..."
aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "general-fan"},
  "name": {"S": "Casey Sports Fan"},
  "preferences": {"L": [
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "soccer"}, "weight": {"N": "6"}}},
    {"M": {"type": {"S": "SPORT"}, "value": {"S": "basketball"}, "weight": {"N": "7"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "celebration"}, "weight": {"N": "8"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "skill_move"}, "weight": {"N": "7"}}}
  ]},
  "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
}' > /dev/null

# Casual viewer
echo "Creating casual viewer user..."
aws dynamodb put-item --table-name GameUsers --item '{
  "userId": {"S": "casual-viewer"},
  "name": {"S": "Sam Casual Viewer"},
  "preferences": {"L": [
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "celebration"}, "weight": {"N": "9"}}},
    {"M": {"type": {"S": "PLAY_TYPE"}, "value": {"S": "crowd_reaction"}, "weight": {"N": "8"}}},
    {"M": {"type": {"S": "EXCITEMENT_LEVEL"}, "value": {"S": "high"}, "weight": {"N": "10"}}}
  ]},
  "createdAt": {"S": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}
}' > /dev/null

echo -e "${GREEN}✅ Created 4 demo user profiles${NC}"

# Create sample highlight data for demo
echo ""
echo -e "${BLUE}🎯 Creating Sample Highlight Data${NC}"

# Sample highlights with different characteristics
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Soccer goal highlight
aws dynamodb put-item --table-name GameHighlights --item '{
  "highlightId": {"S": "demo-soccer-goal-1"},
  "timestamp": {"S": "'$TIMESTAMP'"},
  "gameId": {"S": "demo-soccer-match"},
  "sourceVideo": {"S": "s3://'$VIDEO_BUCKET'/demo/soccer-match.mp4"},
  "startTime": {"N": "45.5"},
  "endTime": {"N": "52.3"},
  "duration": {"N": "6.8"},
  "confidence": {"N": "95.2"},
  "labels": {"L": [{"S": "Ball"}, {"S": "Goal"}, {"S": "Celebration"}, {"S": "Person"}]},
  "personCount": {"N": "8"},
  "processed": {"BOOL": true},
  "status": {"S": "COMPLETED"},
  "excitementLevel": {"N": "9.5"},
  "playType": {"S": "goal"},
  "aiTitle": {"S": "Spectacular Goal in Final Minutes"},
  "targetAudience": {"S": "soccer_fans"},
  "aiEnhanced": {"BOOL": true},
  "teams": {"L": [{"S": "Barcelona"}, {"S": "Real Madrid"}]},
  "sport": {"S": "soccer"}
}' > /dev/null

# Basketball dunk highlight
aws dynamodb put-item --table-name GameHighlights --item '{
  "highlightId": {"S": "demo-basketball-dunk-1"},
  "timestamp": {"S": "'$TIMESTAMP'"},
  "gameId": {"S": "demo-basketball-match"},
  "sourceVideo": {"S": "s3://'$VIDEO_BUCKET'/demo/basketball-match.mp4"},
  "startTime": {"N": "120.2"},
  "endTime": {"N": "125.8"},
  "duration": {"N": "5.6"},
  "confidence": {"N": "92.8"},
  "labels": {"L": [{"S": "Ball"}, {"S": "Person"}, {"S": "Sports"}, {"S": "Crowd"}]},
  "personCount": {"N": "12"},
  "processed": {"BOOL": true},
  "status": {"S": "COMPLETED"},
  "excitementLevel": {"N": "8.7"},
  "playType": {"S": "dunk"},
  "aiTitle": {"S": "Thunderous Slam Dunk"},
  "targetAudience": {"S": "basketball_fans"},
  "aiEnhanced": {"BOOL": true},
  "teams": {"L": [{"S": "Lakers"}, {"S": "Warriors"}]},
  "sport": {"S": "basketball"}
}' > /dev/null

# Soccer save highlight
aws dynamodb put-item --table-name GameHighlights --item '{
  "highlightId": {"S": "demo-soccer-save-1"},
  "timestamp": {"S": "'$TIMESTAMP'"},
  "gameId": {"S": "demo-soccer-match"},
  "sourceVideo": {"S": "s3://'$VIDEO_BUCKET'/demo/soccer-match.mp4"},
  "startTime": {"N": "78.1"},
  "endTime": {"N": "83.4"},
  "duration": {"N": "5.3"},
  "confidence": {"N": "88.5"},
  "labels": {"L": [{"S": "Ball"}, {"S": "Person"}, {"S": "Goal"}, {"S": "Sports"}]},
  "personCount": {"N": "6"},
  "processed": {"BOOL": true},
  "status": {"S": "COMPLETED"},
  "excitementLevel": {"N": "8.2"},
  "playType": {"S": "save"},
  "aiTitle": {"S": "Incredible Goalkeeper Save"},
  "targetAudience": {"S": "soccer_fans"},
  "aiEnhanced": {"BOOL": true},
  "teams": {"L": [{"S": "Barcelona"}, {"S": "Real Madrid"}]},
  "sport": {"S": "soccer"}
}' > /dev/null

# General celebration highlight
aws dynamodb put-item --table-name GameHighlights --item '{
  "highlightId": {"S": "demo-celebration-1"},
  "timestamp": {"S": "'$TIMESTAMP'"},
  "gameId": {"S": "demo-mixed-sports"},
  "sourceVideo": {"S": "s3://'$VIDEO_BUCKET'/demo/mixed-sports.mp4"},
  "startTime": {"N": "200.5"},
  "endTime": {"N": "208.2"},
  "duration": {"N": "7.7"},
  "confidence": {"N": "91.3"},
  "labels": {"L": [{"S": "Celebration"}, {"S": "Person"}, {"S": "Crowd"}, {"S": "Sports"}]},
  "personCount": {"N": "15"},
  "processed": {"BOOL": true},
  "status": {"S": "COMPLETED"},
  "excitementLevel": {"N": "9.8"},
  "playType": {"S": "celebration"},
  "aiTitle": {"S": "Epic Victory Celebration"},
  "targetAudience": {"S": "general_audience"},
  "aiEnhanced": {"BOOL": true},
  "teams": {"L": [{"S": "Team A"}, {"S": "Team B"}]},
  "sport": {"S": "general_sports"}
}' > /dev/null

echo -e "${GREEN}✅ Created 4 sample highlights${NC}"

# Create demo API test data
echo ""
echo -e "${BLUE}🔧 Creating API Test Data${NC}"

# Create a simple test file for API testing
cat > /tmp/demo_api_test.json << EOF
{
  "users": [
    {"id": "soccer-fan", "name": "Alex Soccer Fan"},
    {"id": "basketball-fan", "name": "Jordan Basketball Fan"},
    {"id": "general-fan", "name": "Casey Sports Fan"},
    {"id": "casual-viewer", "name": "Sam Casual Viewer"}
  ],
  "test_scenarios": [
    {
      "name": "Soccer Fan Personalization",
      "user": "soccer-fan",
      "expected_highlights": ["demo-soccer-goal-1", "demo-soccer-save-1"]
    },
    {
      "name": "Basketball Fan Personalization", 
      "user": "basketball-fan",
      "expected_highlights": ["demo-basketball-dunk-1"]
    },
    {
      "name": "General Fan Personalization",
      "user": "general-fan", 
      "expected_highlights": ["demo-celebration-1"]
    }
  ]
}
EOF

echo -e "${GREEN}✅ Created API test data${NC}"

# Provide demo instructions
echo ""
echo -e "${BLUE}🎬 Demo Instructions${NC}"
echo ""
echo -e "${GREEN}Your demo data is ready! Here's how to use it:${NC}"
echo ""
echo -e "${YELLOW}1. Test Personalization API:${NC}"
echo "   # Get personalized highlights for soccer fan"
echo "   curl \"$API_URL/users/soccer-fan/preferences\""
echo ""
echo -e "${YELLOW}2. View All Highlights:${NC}"
echo "   # Get all available highlights"
echo "   curl \"$API_URL/highlights\""
echo ""
echo -e "${YELLOW}3. Check User Data:${NC}"
echo "   # View created users"
echo "   aws dynamodb scan --table-name GameUsers --max-items 10"
echo ""
echo -e "${YELLOW}4. Check Highlight Data:${NC}"
echo "   # View created highlights"
echo "   aws dynamodb scan --table-name GameHighlights --max-items 10"
echo ""
echo -e "${YELLOW}5. Demo Scenarios:${NC}"
echo "   - Show different users getting different recommendations"
echo "   - Demonstrate AI-enhanced metadata (excitementLevel, aiTitle)"
echo "   - Show real-time personalization differences"
echo ""
echo -e "${GREEN}🎯 Demo Data Summary:${NC}"
echo "   ✅ 4 User Profiles (different sports preferences)"
echo "   ✅ 4 Sample Highlights (soccer, basketball, celebration)"
echo "   ✅ AI-Enhanced Metadata (Bedrock-style data)"
echo "   ✅ Personalization Test Scenarios"
echo ""
echo -e "${BLUE}Ready for AWS Summit LA presentation! 🚀${NC}"