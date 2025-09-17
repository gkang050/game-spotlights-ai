const { MediaConvertClient, CreateJobCommand, GetJobCommand, DescribeEndpointsCommand } = require('@aws-sdk/client-mediaconvert');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand, QueryCommand, GetItemCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);

const MEDIACONVERT_ENDPOINT = process.env.MEDIACONVERT_ENDPOINT;
const MEDIACONVERT_ROLE = process.env.MEDIACONVERT_ROLE;
const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const HIGHLIGHTS_BUCKET = process.env.HIGHLIGHTS_BUCKET;
const SOURCE_BUCKET = process.env.SOURCE_BUCKET;

// Initialize MediaConvert with endpoint
let mediaConvert;

/**
 * Processes highlight metadata and creates video clips using MediaConvert
 */
exports.handler = async (event) => {
  console.log('Clip processor event:', JSON.stringify(event, null, 2));
  
  try {
    // Initialize MediaConvert client if not already done
    if (!mediaConvert) {
      await initializeMediaConvert();
    }
    
    // Handle different event types
    if (event.Records) {
      // DynamoDB Stream event - new highlight created
      return await processDynamoDBEvent(event);
    } else if (event.source === 'aws.mediaconvert') {
      // MediaConvert job completion event
      return await processMediaConvertEvent(event);
    } else if (event.highlightId) {
      // Direct invocation for specific highlight
      return await processHighlight(event.highlightId);
    } else {
      // Manual invocation - process all unprocessed highlights
      return await processUnprocessedHighlights();
    }
    
  } catch (error) {
    console.error('Error in clip processor:', error);
    return {
      statusCode: 500,
      body: {
        message: 'Error processing clips',
        error: error.message
      }
    };
  }
};

/**
 * Initialize MediaConvert client with endpoint discovery
 */
async function initializeMediaConvert() {
  try {
    if (MEDIACONVERT_ENDPOINT) {
      // Use provided endpoint
      mediaConvert = new MediaConvertClient({
        endpoint: MEDIACONVERT_ENDPOINT
      });
    } else {
      // Discover endpoint
      const tempClient = new MediaConvertClient({});
      const endpoints = await tempClient.send(new DescribeEndpointsCommand({}));
      
      if (endpoints.Endpoints && endpoints.Endpoints.length > 0) {
        const endpoint = endpoints.Endpoints[0].Url;
        mediaConvert = new MediaConvertClient({
          endpoint: endpoint
        });
        console.log('MediaConvert endpoint discovered:', endpoint);
      } else {
        throw new Error('No MediaConvert endpoints available');
      }
    }
  } catch (error) {
    console.error('Error initializing MediaConvert:', error);
    throw error;
  }
}

/**
 * Process DynamoDB stream events for new highlights
 */
async function processDynamoDBEvent(event) {
  const processedHighlights = [];
  
  for (const record of event.Records) {
    if (record.eventName === 'INSERT' && record.dynamodb?.NewImage) {
      const highlight = unmarshallDynamoDBItem(record.dynamodb.NewImage);
      
      // Only process highlights that don't have clips yet
      if (!highlight.clipGenerated && highlight.processed !== false) {
        const result = await processHighlight(highlight.highlightId);
        processedHighlights.push(result);
      }
    }
  }
  
  return {
    statusCode: 200,
    body: {
      message: 'DynamoDB events processed',
      processedHighlights: processedHighlights.length,
      results: processedHighlights
    }
  };
}

/**
 * Process MediaConvert job completion events
 */
async function processMediaConvertEvent(event) {
  const jobId = event.detail?.jobId;
  const status = event.detail?.status;
  
  if (!jobId) {
    throw new Error('Missing job ID in MediaConvert event');
  }
  
  console.log(`MediaConvert job ${jobId} status: ${status}`);
  
  if (status === 'COMPLETE') {
    // Update highlight record with clip information
    await updateHighlightWithClipInfo(jobId);
  } else if (status === 'ERROR') {
    console.error(`MediaConvert job ${jobId} failed`);
    await markHighlightAsFailed(jobId);
  }
  
  return {
    statusCode: 200,
    body: {
      message: 'MediaConvert event processed',
      jobId,
      status
    }
  };
}

/**
 * Process a specific highlight to create video clip
 */
async function processHighlight(highlightId) {
  console.log(`Processing highlight: ${highlightId}`);
  
  try {
    // Get highlight metadata from DynamoDB
    const highlight = await getHighlightMetadata(highlightId);
    
    if (!highlight) {
      throw new Error(`Highlight ${highlightId} not found`);
    }
    
    if (highlight.clipGenerated) {
      console.log(`Highlight ${highlightId} already has clip generated`);
      return {
        highlightId,
        status: 'already_processed',
        clipUrl: highlight.clipUrl
      };
    }
    
    // Extract source video information
    const sourceVideoUrl = highlight.sourceVideo; // s3://bucket/key
    const { bucket: sourceBucket, key: sourceKey } = parseS3Url(sourceVideoUrl);
    
    // Create MediaConvert job
    const jobId = await createClipGenerationJob(highlight, sourceBucket, sourceKey);
    
    // Update highlight with job information
    await updateHighlightJobInfo(highlightId, jobId);
    
    return {
      highlightId,
      status: 'job_created',
      jobId,
      message: 'Video clip generation started'
    };
    
  } catch (error) {
    console.error(`Error processing highlight ${highlightId}:`, error);
    throw error;
  }
}

/**
 * Create MediaConvert job for clip generation
 */
async function createClipGenerationJob(highlight, sourceBucket, sourceKey) {
  const clipKey = `clips/${highlight.highlightId}.mp4`;
  const thumbnailKey = `thumbnails/${highlight.highlightId}.jpg`;
  
  // Convert timestamps to timecode format (HH:MM:SS:FF)
  const startTimecode = secondsToTimecode(highlight.startTime);
  const endTimecode = secondsToTimecode(highlight.endTime);
  
  const jobParams = {
    Role: MEDIACONVERT_ROLE,
    Settings: {
      Inputs: [
        {
          FileInput: `s3://${sourceBucket}/${sourceKey}`,
          InputClippings: [
            {
              StartTimecode: startTimecode,
              EndTimecode: endTimecode
            }
          ],
          VideoSelector: {
            ColorSpace: 'FOLLOW'
          },
          AudioSelectors: {
            'Audio Selector 1': {
              DefaultSelection: 'DEFAULT'
            }
          }
        }
      ],
      OutputGroups: [
        {
          Name: 'File Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${HIGHLIGHTS_BUCKET}/clips/`
            }
          },
          Outputs: [
            {
              NameModifier: `_${highlight.highlightId}`,
              ContainerSettings: {
                Container: 'MP4',
                Mp4Settings: {
                  CslgAtom: 'INCLUDE',
                  FreeSpaceBox: 'EXCLUDE',
                  MoovPlacement: 'PROGRESSIVE_DOWNLOAD'
                }
              },
              VideoDescription: {
                Width: 1280,
                Height: 720,
                CodecSettings: {
                  Codec: 'H_264',
                  H264Settings: {
                    MaxBitrate: 2000000,
                    RateControlMode: 'QVBR',
                    QvbrSettings: {
                      QvbrQualityLevel: 7
                    }
                  }
                }
              },
              AudioDescriptions: [
                {
                  AudioSourceName: 'Audio Selector 1',
                  CodecSettings: {
                    Codec: 'AAC',
                    AacSettings: {
                      Bitrate: 128000,
                      CodingMode: 'CODING_MODE_2_0',
                      SampleRate: 48000
                    }
                  }
                }
              ]
            }
          ]
        },
        {
          Name: 'Thumbnail Group',
          OutputGroupSettings: {
            Type: 'FILE_GROUP_SETTINGS',
            FileGroupSettings: {
              Destination: `s3://${HIGHLIGHTS_BUCKET}/thumbnails/`
            }
          },
          Outputs: [
            {
              NameModifier: `_${highlight.highlightId}`,
              ContainerSettings: {
                Container: 'RAW'
              },
              VideoDescription: {
                Width: 320,
                Height: 180,
                CodecSettings: {
                  Codec: 'FRAME_CAPTURE',
                  FrameCaptureSettings: {
                    FramerateNumerator: 1,
                    FramerateDenominator: 2,
                    MaxCaptures: 1,
                    Quality: 80
                  }
                }
              }
            }
          ]
        }
      ]
    },
    UserMetadata: {
      highlightId: highlight.highlightId,
      sport: highlight.sport || 'unknown',
      playType: highlight.playType || 'unknown'
    }
  };
  
  console.log('Creating MediaConvert job with params:', JSON.stringify(jobParams, null, 2));
  
  const command = new CreateJobCommand(jobParams);
  const response = await mediaConvert.send(command);
  
  console.log(`MediaConvert job created: ${response.Job.Id}`);
  return response.Job.Id;
}

/**
 * Get highlight metadata from DynamoDB
 */
async function getHighlightMetadata(highlightId) {
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    Key: {
      highlightId: highlightId
    }
  };
  
  const result = await dynamoDB.send(new GetItemCommand(params));
  return result.Item;
}

/**
 * Update highlight with MediaConvert job information
 */
async function updateHighlightJobInfo(highlightId, jobId) {
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    Key: {
      highlightId: highlightId
    },
    UpdateExpression: 'SET mediaConvertJobId = :jobId, clipGenerationStarted = :timestamp, clipStatus = :status',
    ExpressionAttributeValues: {
      ':jobId': jobId,
      ':timestamp': new Date().toISOString(),
      ':status': 'processing'
    }
  };
  
  await dynamoDB.send(new UpdateCommand(params));
}

/**
 * Update highlight with clip information after successful generation
 */
async function updateHighlightWithClipInfo(jobId) {
  try {
    // Get job details to find the highlight
    const jobCommand = new GetJobCommand({ Id: jobId });
    const jobResult = await mediaConvert.send(jobCommand);
    
    const highlightId = jobResult.Job.UserMetadata?.highlightId;
    if (!highlightId) {
      console.error('No highlightId found in job metadata');
      return;
    }
    
    // Generate URLs for the clip and thumbnail
    const clipUrl = `https://${HIGHLIGHTS_BUCKET}.s3.amazonaws.com/clips/${highlightId}.mp4`;
    const thumbnailUrl = `https://${HIGHLIGHTS_BUCKET}.s3.amazonaws.com/thumbnails/${highlightId}.jpg`;
    
    // Update DynamoDB record
    const params = {
      TableName: HIGHLIGHTS_TABLE,
      Key: {
        highlightId: highlightId
      },
      UpdateExpression: 'SET clipGenerated = :generated, clipUrl = :clipUrl, thumbnailUrl = :thumbnailUrl, clipStatus = :status, clipGeneratedAt = :timestamp',
      ExpressionAttributeValues: {
        ':generated': true,
        ':clipUrl': clipUrl,
        ':thumbnailUrl': thumbnailUrl,
        ':status': 'completed',
        ':timestamp': new Date().toISOString()
      }
    };
    
    await dynamoDB.send(new UpdateCommand(params));
    console.log(`Updated highlight ${highlightId} with clip information`);
    
  } catch (error) {
    console.error('Error updating highlight with clip info:', error);
    throw error;
  }
}

/**
 * Mark highlight as failed
 */
async function markHighlightAsFailed(jobId) {
  try {
    const jobCommand = new GetJobCommand({ Id: jobId });
    const jobResult = await mediaConvert.send(jobCommand);
    
    const highlightId = jobResult.Job.UserMetadata?.highlightId;
    if (!highlightId) {
      console.error('No highlightId found in job metadata');
      return;
    }
    
    const params = {
      TableName: HIGHLIGHTS_TABLE,
      Key: {
        highlightId: highlightId
      },
      UpdateExpression: 'SET clipStatus = :status, clipError = :error, clipGeneratedAt = :timestamp',
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':error': 'MediaConvert job failed',
        ':timestamp': new Date().toISOString()
      }
    };
    
    await dynamoDB.send(new UpdateCommand(params));
    console.log(`Marked highlight ${highlightId} as failed`);
    
  } catch (error) {
    console.error('Error marking highlight as failed:', error);
  }
}

/**
 * Process all unprocessed highlights
 */
async function processUnprocessedHighlights() {
  const params = {
    TableName: HIGHLIGHTS_TABLE,
    FilterExpression: 'attribute_not_exists(clipGenerated) OR clipGenerated = :false',
    ExpressionAttributeValues: {
      ':false': false
    }
  };
  
  const result = await dynamoDB.send(new ScanCommand(params));
  const processedResults = [];
  
  for (const highlight of result.Items || []) {
    try {
      const result = await processHighlight(highlight.highlightId);
      processedResults.push(result);
    } catch (error) {
      console.error(`Error processing highlight ${highlight.highlightId}:`, error);
      processedResults.push({
        highlightId: highlight.highlightId,
        status: 'error',
        error: error.message
      });
    }
  }
  
  return {
    statusCode: 200,
    body: {
      message: 'Batch processing completed',
      processedHighlights: processedResults.length,
      results: processedResults
    }
  };
}

/**
 * Generate signed URL for secure video access
 */
async function generateSignedUrl(bucket, key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });
  
  return await getSignedUrl(s3, command, { expiresIn });
}

/**
 * Utility functions
 */
function parseS3Url(s3Url) {
  const match = s3Url.match(/s3:\/\/([^\/]+)\/(.+)/);
  if (!match) {
    throw new Error(`Invalid S3 URL: ${s3Url}`);
  }
  return {
    bucket: match[1],
    key: match[2]
  };
}

function secondsToTimecode(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const frames = Math.floor((seconds % 1) * 30); // Assuming 30fps
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

function unmarshallDynamoDBItem(item) {
  const result = {};
  for (const [key, value] of Object.entries(item)) {
    if (value.S) result[key] = value.S;
    else if (value.N) result[key] = parseFloat(value.N);
    else if (value.BOOL) result[key] = value.BOOL;
    else if (value.SS) result[key] = value.SS;
    else if (value.L) result[key] = value.L.map(v => unmarshallDynamoDBItem({ item: v }).item);
  }
  return result;
}
