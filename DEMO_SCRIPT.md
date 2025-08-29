# 🎮 Game Highlights AI - AWS Summit Demo Script

## 🎯 Demo Overview (5 minutes)
Show how AI transforms sports video content into personalized highlights using AWS services.

## 📋 Demo Flow

### 1. Introduction (30 seconds)
"Today I'll show you how we built an AI-powered sports highlights system that automatically analyzes gaming videos and creates personalized content for different users."

### 2. Architecture Overview (1 minute)
- **AWS Services Used:** Lambda, DynamoDB, S3, API Gateway, Rekognition, Bedrock
- **AI Features:** Video analysis, content personalization, excitement detection
- **Real-time API:** RESTful endpoints for web/mobile integration

### 3. Live API Demo (2 minutes)

**Show General Highlights:**
```bash
curl "https://frmy6y6wl5.execute-api.us-east-1.amazonaws.com/prod/highlights" | jq .
```

**Demonstrate Personalization:**
```bash
# Soccer fan gets soccer-focused content
curl "https://frmy6y6wl5.execute-api.us-east-1.amazonaws.com/prod/users/soccer-fan/preferences" | jq .

# Basketball fan gets different content
curl "https://frmy6y6wl5.execute-api.us-east-1.amazonaws.com/prod/users/basketball-fan/preferences" | jq .
```

### 4. Key AI Features to Highlight (1 minute)

**Point out in the JSON response:**
- `excitementLevel`: AI-detected excitement (1-10 scale)
- `aiEnhanced`: Content processed by Amazon Bedrock
- `personalizedScore`: Personalization algorithm score
- `playType`: AI-classified play types (goal, dunk, winner)

### 5. Business Value (30 seconds)
- **Automated Content Creation:** No manual video editing
- **Personalized Experience:** Each user sees relevant content
- **Scalable Architecture:** Handles thousands of videos
- **Real-time Processing:** Instant highlight generation

## 🎤 Key Talking Points

1. **"AI-First Approach"** - Every highlight is enhanced with AI metadata
2. **"Personalization at Scale"** - Different users see different content
3. **"Serverless Architecture"** - Pay only for what you use
4. **"Multi-Sport Support"** - Works across different sports

## 🔧 Backup Demo Options

If live API fails, use the HTML demo page:
1. Open `demo-test.html` in browser
2. Click buttons to show different user experiences
3. Highlight the real-time personalization differences

## 📊 Expected Results

**All Highlights Response:**
- 3 demo highlights (soccer, basketball, tennis)
- AI excitement levels (7-9)
- Multiple sports represented

**Personalized Response:**
- User-specific content ordering
- Higher scores for preferred sports
- AI-enhanced metadata

## 🎯 Call to Action

"This is just the beginning. Imagine this technology applied to:
- Live sports broadcasting
- Gaming content creation  
- Social media highlights
- Training video analysis

The infrastructure is ready to scale from prototype to production."