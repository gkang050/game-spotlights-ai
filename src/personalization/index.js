const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const personalize = new AWS.Personalize();
const personalizeRuntime = new AWS.PersonalizeRuntime();

const PREFERENCES_TABLE = process.env.PREFERENCES_TABLE;
const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const CAMPAIGN_ARN = process.env.PERSONALIZE_CAMPAIGN_ARN;

/**
 * Personalizes highlight recommendations based on user preferences
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Get user ID from the event
    const userId = event.userId || event.body?.userId;
    
    if (!userId) {
      return {
        statusCode: 400,
        body: {
          message: 'Missing userId parameter'
        }
      };
    }
    
    // Get user preferences
    const userPreferences = await getUserPreferences(userId);
    
    // Get available highlights
    const highlights = await getAvailableHighlights();
    
    if (highlights.length === 0) {
      return {
        statusCode: 200,
        body: {
          message: 'No highlights available for personalization',
          highlights: []
        }
      };
    }
    
    // Personalize highlights based on user preferences
    let personalizedHighlights;
    
    if (CAMPAIGN_ARN) {
      // Use Amazon Personalize if configured
      personalizedHighlights = await getPersonalizeRecommendations(userId, highlights);
    } else {
      // Fall back to rule-based personalization
      personalizedHighlights = await ruleBasedPersonalization(highlights, userPreferences);
    }
    
    return {
      statusCode: 200,
      body: {
        message: 'Highlights personalized successfully',
        userId,
        highlightsCount: personalizedHighlights.length,
        highlights: personalizedHighlights
      }
    };
  } catch (error) {
    console.error('Error personalizing highlights:', error);
    
    return {
      statusCode: 500,
      body: {
        message: 'Error personalizing highlights',
        error: error.message
      }
    };
  }
};

/**
 * Get user preferences from DynamoDB
 */
async function getUserPreferences(userId) {
  const params = {
    TableName: PREFERENCES_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  return result.Items || [];
}

/**
 * Get available highlights from DynamoDB
 */
async function getAvailableHighlights() {
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    FilterExpression: 'processed = :processed AND #status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':processed': true,
      ':status': 'COMPLETED'
    },
    Limit: 100 // Limit to most recent 100 highlights
  };
  
  const result = await dynamoDB.scan(params).promise();
  return result.Items || [];
}

/**
 * Get personalized recommendations using Amazon Personalize
 */
async function getPersonalizeRecommendations(userId, highlights) {
  try {
    // Get recommendations from Personalize
    const params = {
      campaignArn: CAMPAIGN_ARN,
      userId,
      numResults: 25
    };
    
    const response = await personalizeRuntime.getRecommendations(params).promise();
    
    // Map item IDs to highlight objects
    const recommendedItemIds = response.itemList.map(item => item.itemId);
    const highlightMap = {};
    
    highlights.forEach(highlight => {
      highlightMap[highlight.highlightId] = highlight;
    });
    
    // Return highlights in recommended order
    return recommendedItemIds
      .map(itemId => highlightMap[itemId])
      .filter(highlight => highlight !== undefined);
  } catch (error) {
    console.error('Error getting Personalize recommendations:', error);
    // Fall back to rule-based personalization
    return ruleBasedPersonalization(highlights, await getUserPreferences(userId));
  }
}

/**
 * Rule-based personalization algorithm
 */
async function ruleBasedPersonalization(highlights, preferences) {
  // Create preference maps for quick lookup
  const preferenceMap = {
    TEAM: {},
    PLAYER: {},
    PLAY_TYPE: {},
    SPORT: {}
  };
  
  preferences.forEach(pref => {
    if (!preferenceMap[pref.type]) {
      preferenceMap[pref.type] = {};
    }
    
    preferenceMap[pref.type][pref.value] = pref.weight || 1;
  });
  
  // Score each highlight based on user preferences
  const scoredHighlights = highlights.map(highlight => {
    let score = highlight.confidence || 0;
    
    // Add points for teams
    if (highlight.teams) {
      highlight.teams.forEach(team => {
        if (preferenceMap.TEAM[team]) {
          score += 10 * preferenceMap.TEAM[team];
        }
      });
    }
    
    // Add points for players
    if (highlight.players) {
      highlight.players.forEach(player => {
        if (preferenceMap.PLAYER[player]) {
          score += 15 * preferenceMap.PLAYER[player];
        }
      });
    }
    
    // Add points for play type
    if (highlight.playType && preferenceMap.PLAY_TYPE[highlight.playType]) {
      score += 5 * preferenceMap.PLAY_TYPE[highlight.playType];
    }
    
    // Add points for sport
    if (highlight.sport && preferenceMap.SPORT[highlight.sport]) {
      score += 3 * preferenceMap.SPORT[highlight.sport];
    }
    
    return {
      ...highlight,
      personalizedScore: score
    };
  });
  
  // Sort by personalized score
  return scoredHighlights.sort((a, b) => b.personalizedScore - a.personalizedScore);
}