const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();
const mediaConvert = new AWS.MediaConvert({
  endpoint: process.env.MEDIA_CONVERT_ENDPOINT || 'https://mediaconvert.us-east-1.amazonaws.com'
});

const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const RAW_VIDEOS_BUCKET = process.env.RAW_VIDEOS_BUCKET;
const PROCESSED_VIDEOS_BUCKET = process.env.PROCESSED_VIDEOS_BUCKET;

/**
 * Generates highlight clips from raw video based on analysis results
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Get highlight metadata from previous step or query DynamoDB
    let highlights = event.highlights;
    const gameId = event.gameId || event.body?.gameId;
    const videoKey = event.videoKey || event.body?.videoKey;
    
    if (!highlights && gameId) {
      // Query highlights from DynamoDB if not provided in the event
      highlights = await queryHighlightsForGame(gameId);
    }
    
    if (!highlights || highlights.length === 0) {
      return {
        statusCode: 400,
        body: {
          message: 'No highlights found for processing'
        }
      };
    }
    
    console.log(`Processing ${highlights.length} highlights`);
    
    // Process each highlight
    const processedHighlights = await Promise.all(
      highlights.map(highlight => processHighlight(highlight, videoKey))
    );
    
    return {
      statusCode: 200,
      body: {
        message: 'Highlight generation completed successfully',
        highlightsProcessed: processedHighlights.length,
        highlights: processedHighlights
      }
    };
  } catch (error) {
    console.error('Error generating highlights:', error);
    
    return {
      statusCode: 500,
      body: {
        message: 'Error generating highlights',
        error: error.message
      }
    };
  }
};

/**
 * Query highlights for a specific game from DynamoDB
 */
async function queryHighlightsForGame(gameId) {
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    IndexName: 'GameIdIndex', // Assuming a GSI on gameId
    KeyConditionExpression: 'gameId = :gameId',
    FilterExpression: 'processed = :processed',
    ExpressionAttributeValues: {
      ':gameId': gameId,
      ':processed': false
    }
  };
  
  const result = await dynamoDB.query(params).promise();
  return result.Items;
}

/**
 * Process a single highlight
 */
async function processHighlight(highlight, videoKey) {
  try {
    // Determine source video location
    const sourceVideo = highlight.sourceVideo || `s3://${RAW_VIDEOS_BUCKET}/${videoKey}`;
    
    // Generate output key for the highlight clip
    const outputKey = generateOutputKey(highlight);
    
    // Create MediaConvert job to extract the highlight clip
    const jobParams = createMediaConvertJobParams(
      sourceVideo,
      highlight.startTime,
      highlight.duration,
      outputKey
    );
    
    const jobResult = await mediaConvert.createJob(jobParams).promise();
    
    // Update highlight record in DynamoDB
    await updateHighlightRecord(highlight.highlightId, {
      processed: true,
      mediaConvertJobId: jobResult.Job.Id,
      videoUrl: `s3://${PROCESSED_VIDEOS_BUCKET}/${outputKey}`,
      status: 'PROCESSING'
    });
    
    return {
      highlightId: highlight.highlightId,
      outputKey,
      jobId: jobResult.Job.Id,
      status: 'PROCESSING'
    };
  } catch (error) {
    console.error(`Error processing highlight ${highlight.highlightId}:`, error);
    
    // Update highlight record with error status
    await updateHighlightRecord(highlight.highlightId, {
      processed: false,
      status: 'ERROR',
      errorMessage: error.message
    });
    
    return {
      highlightId: highlight.highlightId,
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Generate output key for the highlight clip
 */
function generateOutputKey(highlight) {
  const timestamp = new Date().getTime();
  return `highlights/${highlight.gameId}/${highlight.highlightId}-${timestamp}.mp4`;
}

/**
 * Create MediaConvert job parameters
 */
function createMediaConvertJobParams(sourceVideo, startTime, duration, outputKey) {
  return {
    Role: process.env.MEDIA_CONVERT_ROLE || 'MediaConvertRole',
    Settings: {
      Inputs: [
        {
          FileInput: sourceVideo,
          InputClippings: [
            {
              StartTimecode: secondsToTimecode(startTime),
              EndTimecode: secondsToTimecode(startTime + duration)
            }
          ],
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT'
            }
          },
          VideoSelector: {}
        }
      ],
      OutputGroups: [
        {
          Name: 'File Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${PROCESSED_VIDEOS_BUCKET}/${outputKey}`
            }
          },
          Outputs: [
            {
              VideoDescription: {
                ScalingBehavior: 'DEFAULT',
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: {
                    RateControlMode: 'QVBR',
                    QvbrSettings: {
                      QvbrQualityLevel: 8
                    },
                    MaxBitrate: 5000000
                  }
                }
              },
              AudioDescriptions: [
                {
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 96000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000
                    }
                  }
                }
              ],
              ContainerSettings: {
                Container: 'MP4',
                Mp4Settings: {}
              }
            }
          ]
        }
      ]
    }
  };
}

/**
 * Convert seconds to timecode format (HH:MM:SS:FF)
 */
function secondsToTimecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

/**
 * Update highlight record in DynamoDB
 */
async function updateHighlightRecord(highlightId, updates) {
  // Build update expression and attribute values
  const updateExpressionParts = [];
  const expressionAttributeValues = {};
  const expressionAttributeNames = {};
  
  Object.entries(updates).forEach(([key, value]) => {
    updateExpressionParts.push(`#${key} = :${key}`);
    expressionAttributeValues[`:${key}`] = value;
    expressionAttributeNames[`#${key}`] = key;
  });
  
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    Key: { highlightId },
    UpdateExpression: `SET ${updateExpressionParts.join(', ')}`,
    ExpressionAttributeValues: expressionAttributeValues,
    ExpressionAttributeNames: expressionAttributeNames,
    ReturnValues: 'UPDATED_NEW'
  };
  
  return await dynamoDB.update(params).promise();
}