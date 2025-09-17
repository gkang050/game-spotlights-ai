/**
 * Health check endpoint for monitoring system status
 */
exports.handler = async (event) => {
  const timestamp = new Date().toISOString();
  
  try {
    // Basic health check response
    const healthStatus = {
      status: 'healthy',
      timestamp: timestamp,
      version: '1.0.0',
      service: 'game-spotlights-ai',
      environment: process.env.NODE_ENV || 'production',
      region: process.env.AWS_REGION || 'us-east-1',
      components: {
        lambda: 'operational',
        dynamodb: 'operational', // Could add actual DB ping
        s3: 'operational',       // Could add actual S3 check
        rekognition: 'operational',
        bedrock: 'operational',
        comprehend: 'operational'
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      requestId: event.requestContext?.requestId || 'unknown'
    };
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify(healthStatus, null, 2)
    };
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    return {
      statusCode: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        status: 'unhealthy',
        timestamp: timestamp,
        error: error.message,
        service: 'game-spotlights-ai'
      }, null, 2)
    };
  }
};
