/**
 * Simple demo version for personalization
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    const userId = event.pathParameters?.userId || 'demo-user';
    
    // Return personalized demo highlights
    const personalizedHighlights = [
      {
        highlightId: 'personalized-1',
        title: `Personalized for ${userId}: Epic Soccer Goal`,
        description: 'AI-selected based on your soccer preferences',
        duration: 15,
        sport: 'soccer',
        excitementLevel: 9,
        playType: 'goal',
        personalizedScore: 95,
        aiEnhanced: true,
        timestamp: new Date().toISOString()
      },
      {
        highlightId: 'personalized-2',
        title: `Trending: Basketball Highlight`,
        description: 'Popular among users with similar preferences',
        duration: 12,
        sport: 'basketball',
        excitementLevel: 8,
        playType: 'dunk',
        personalizedScore: 87,
        aiEnhanced: true,
        timestamp: new Date().toISOString()
      }
    ];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Personalized highlights retrieved successfully',
        userId,
        highlightsCount: personalizedHighlights.length,
        highlights: personalizedHighlights,
        demo: true
      })
    };
  } catch (error) {
    console.error('Error personalizing highlights:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Error personalizing highlights',
        error: error.message
      })
    };
  }
};