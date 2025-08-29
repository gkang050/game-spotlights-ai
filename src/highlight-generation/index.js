/**
 * Simple demo version that returns mock highlights
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Return demo highlights for immediate functionality
    const demoHighlights = [
      {
        highlightId: 'demo-1',
        title: 'Amazing Soccer Goal',
        description: 'Incredible long-range shot that found the top corner',
        duration: 15,
        sport: 'soccer',
        excitementLevel: 9,
        playType: 'goal',
        aiEnhanced: true,
        timestamp: new Date().toISOString(),
        videoUrl: 'https://example.com/highlight1.mp4',
        thumbnailUrl: 'https://example.com/thumb1.jpg'
      },
      {
        highlightId: 'demo-2',
        title: 'Basketball Slam Dunk',
        description: 'Powerful dunk that brought the crowd to their feet',
        duration: 8,
        sport: 'basketball',
        excitementLevel: 8,
        playType: 'dunk',
        aiEnhanced: true,
        timestamp: new Date().toISOString(),
        videoUrl: 'https://example.com/highlight2.mp4',
        thumbnailUrl: 'https://example.com/thumb2.jpg'
      },
      {
        highlightId: 'demo-3',
        title: 'Tennis Winner',
        description: 'Cross-court winner to seal the match',
        duration: 12,
        sport: 'tennis',
        excitementLevel: 7,
        playType: 'winner',
        aiEnhanced: true,
        timestamp: new Date().toISOString(),
        videoUrl: 'https://example.com/highlight3.mp4',
        thumbnailUrl: 'https://example.com/thumb3.jpg'
      }
    ];
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Demo highlights retrieved successfully',
        highlightsCount: demoHighlights.length,
        highlights: demoHighlights,
        demo: true
      })
    };
  } catch (error) {
    console.error('Error generating highlights:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: 'Error generating highlights',
        error: error.message
      })
    };
  }
};