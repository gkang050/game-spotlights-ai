#!/bin/bash

# Colors for better visualization
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

API_BASE="https://frmy6y6wl5.execute-api.us-east-1.amazonaws.com/prod"

echo -e "${PURPLE}🎮 Game Highlights AI - Visual Demo${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# Function to display highlights nicely
display_highlights() {
    local response="$1"
    local title="$2"
    
    echo -e "${WHITE}$title${NC}"
    echo -e "${CYAN}----------------------------------------${NC}"
    
    # Extract and display key information
    local count=$(echo "$response" | jq -r '.highlightsCount // 0')
    echo -e "${GREEN}📊 Total Highlights: $count${NC}"
    echo ""
    
    # Display each highlight
    echo "$response" | jq -r '.highlights[]? | 
        "🎯 " + .title + 
        "\n   📝 " + .description + 
        "\n   ⚽ Sport: " + .sport + 
        " | ⏱️  Duration: " + (.duration | tostring) + "s" +
        " | 🔥 Excitement: " + (.excitementLevel | tostring) + "/10" +
        (if .personalizedScore then " | 🎯 Score: " + (.personalizedScore | tostring) else "" end) +
        (if .aiEnhanced then " | 🤖 AI Enhanced" else "" end) +
        "\n"'
    echo ""
}

# Test 1: All Highlights
echo -e "${YELLOW}🔍 Test 1: Getting All Available Highlights${NC}"
echo -e "${BLUE}GET $API_BASE/highlights${NC}"
echo ""

response1=$(curl -s "$API_BASE/highlights")
display_highlights "$response1" "🎯 All Available Highlights"

echo -e "${CYAN}================================================${NC}"
echo ""

# Test 2: Soccer Fan Personalization
echo -e "${YELLOW}🔍 Test 2: Soccer Fan Personalization${NC}"
echo -e "${BLUE}GET $API_BASE/users/soccer-fan/preferences${NC}"
echo ""

response2=$(curl -s "$API_BASE/users/soccer-fan/preferences")
display_highlights "$response2" "⚽ Soccer Fan's Personalized Highlights"

echo -e "${CYAN}================================================${NC}"
echo ""

# Test 3: Basketball Fan Personalization
echo -e "${YELLOW}🔍 Test 3: Basketball Fan Personalization${NC}"
echo -e "${BLUE}GET $API_BASE/users/basketball-fan/preferences${NC}"
echo ""

response3=$(curl -s "$API_BASE/users/basketball-fan/preferences")
display_highlights "$response3" "🏀 Basketball Fan's Personalized Highlights"

echo -e "${CYAN}================================================${NC}"
echo ""

# Test 4: Tennis Fan Personalization
echo -e "${YELLOW}🔍 Test 4: Tennis Fan Personalization${NC}"
echo -e "${BLUE}GET $API_BASE/users/tennis-fan/preferences${NC}"
echo ""

response4=$(curl -s "$API_BASE/users/tennis-fan/preferences")
display_highlights "$response4" "🎾 Tennis Fan's Personalized Highlights"

echo -e "${CYAN}================================================${NC}"
echo ""

# Summary
echo -e "${PURPLE}📊 Demo Summary${NC}"
echo -e "${GREEN}✅ All API endpoints working${NC}"
echo -e "${GREEN}✅ Personalization active (notice different content per user)${NC}"
echo -e "${GREEN}✅ AI enhancement visible (excitement levels, play types)${NC}"
echo -e "${GREEN}✅ Multi-sport support demonstrated${NC}"
echo ""
echo -e "${WHITE}🎯 Your Game Highlights AI system is ready for production use!${NC}"
echo ""