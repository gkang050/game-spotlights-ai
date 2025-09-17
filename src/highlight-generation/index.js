const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({});

const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const HIGHLIGHTS_BUCKET = process.env.HIGHLIGHTS_BUCKET;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

/**
 * Enhanced highlight generation with real data from DynamoDB
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Check if we should return real highlights or demo data
    const useRealData = process.env.USE_REAL_DATA === 'true';
    
    if (useRealData) {
      // Get real highlights from DynamoDB
      const realHighlights = await getRealHighlights();
      
      if (realHighlights.length > 0) {
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            message: 'Real highlights retrieved successfully',
            highlightsCount: realHighlights.length,
            highlights: realHighlights,
            source: 'dynamodb'
          })
        };
      }
    }
    
    // Fallback to demo highlights with enhanced URLs
    const demoHighlights = await getDemoHighlightsWithRealUrls();
    
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
        source: 'demo-with-real-urls'
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

/**
 * Get real highlights from DynamoDB
 */
async function getRealHighlights() {
  try {
    const params = {
      TableName: HIGHLIGHTS_TABLE,
      FilterExpression: 'clipGenerated = :true',
      ExpressionAttributeValues: {
        ':true': true
      },
      Limit: 10 // Limit for demo purposes
    };
    
    const result = await dynamoDB.send(new ScanCommand(params));
    
    return (result.Items || []).map(item => ({
      highlightId: item.highlightId,
      title: item.aiTitle || item.title || 'Generated Highlight',
      description: item.description || 'AI-generated gaming highlight',
      duration: item.duration,
      sport: item.sport || extractSportFromLabels(item.labels),
      excitementLevel: item.excitementLevel || 5,
      playType: item.playType || 'general',
      aiEnhanced: item.aiEnhanced || false,
      comprehendEnhanced: item.comprehendEnhanced || false,
      timestamp: item.timestamp,
      videoUrl: item.clipUrl ? generateCloudFrontUrl(item.clipUrl) : null,
      thumbnailUrl: item.thumbnailUrl ? generateCloudFrontUrl(item.thumbnailUrl) : null,
      personalizedScore: calculateBaseScore(item),
      confidence: item.confidence,
      source: item.source || 'processed'
    }));
    
  } catch (error) {
    console.error('Error getting real highlights:', error);
    return [];
  }
}

/**
 * Get demo highlights with real S3/CloudFront URLs
 */
async function getDemoHighlightsWithRealUrls() {
  const baseHighlights = [
    {
      highlightId: 'demo-1',
      title: 'Amazing Soccer Goal',
      description: 'Incredible long-range shot that found the top corner',
      duration: 15,
      sport: 'soccer',
      excitementLevel: 9,
      playType: 'goal',
      aiEnhanced: true,
      comprehendEnhanced: true,
      timestamp: new Date().toISOString()
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
      comprehendEnhanced: true,
      timestamp: new Date().toISOString()
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
      comprehendEnhanced: true,
      timestamp: new Date().toISOString()
    }
  ];
  
  // Add real URLs (signed URLs for S3 or CloudFront URLs if available)
  return baseHighlights.map(highlight => ({
    ...highlight,
    videoUrl: generateCloudFrontUrl(`clips/${highlight.highlightId}.mp4`),
    thumbnailUrl: generateCloudFrontUrl(`thumbnails/${highlight.highlightId}.jpg`),
    signedVideoUrl: null, // Will be generated on demand
    personalizedScore: 85 + Math.floor(Math.random() * 15) // 85-99
  }));
}

/**
 * Generate CloudFront URL for video delivery
 */
function generateCloudFrontUrl(s3Key) {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  } else {
    // Fallback to S3 direct URL
    return `https://${HIGHLIGHTS_BUCKET}.s3.amazonaws.com/${s3Key}`;
  }
}

/**
 * Generate signed URL for secure access
 */
async function generateSignedVideoUrl(s3Key) {
  try {
    const command = new GetObjectCommand({
      Bucket: HIGHLIGHTS_BUCKET,
      Key: s3Key
    });
    
    return await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

/**
 * Extract sport from Rekognition labels
 */
function extractSportFromLabels(labels) {
  if (!labels || !Array.isArray(labels)) return 'general';
  
  const labelStr = labels.join(' ').toLowerCase();
  if (labelStr.includes('ball') && labelStr.includes('goal')) return 'soccer';
  if (labelStr.includes('basketball') || labelStr.includes('dunk')) return 'basketball';
  if (labelStr.includes('tennis') || labelStr.includes('racket')) return 'tennis';
  
  return 'general';
}

/**
 * Calculate base personalization score
 */
function calculateBaseScore(highlight) {
  let score = 50; // Base score
  
  // Add excitement factor
  score += (highlight.excitementLevel || 5) * 5;
  
  // Add confidence factor
  score += (highlight.confidence || 70) * 0.3;
  
  // Add AI enhancement bonus
  if (highlight.aiEnhanced) score += 10;
  if (highlight.comprehendEnhanced) score += 5;
  
  return Math.min(100, Math.max(0, Math.round(score)));
}