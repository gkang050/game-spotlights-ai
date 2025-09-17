/**
 * Simple demo version for personalization
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Input validation
    const userId = event.pathParameters?.userId || 'demo-user';
    
    // Validate userId format
    if (typeof userId !== 'string' || userId.trim() === '') {
      throw new Error('Invalid user ID provided');
    }
    
    // Sanitize userId to prevent injection attacks
    const sanitizedUserId = userId.trim().replace(/[^a-zA-Z0-9-_]/g, '');
    
    if (sanitizedUserId !== userId.trim()) {
      console.warn(`User ID sanitized from '${userId}' to '${sanitizedUserId}'`);
    }
    
    // Return personalized demo highlights
    const personalizedHighlights = [
      {
        highlightId: 'personalized-1',
        title: `Personalized for ${sanitizedUserId}: Epic Soccer Goal`,
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
        userId: sanitizedUserId,
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