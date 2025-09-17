const { KinesisVideoClient, DescribeStreamCommand } = require('@aws-sdk/client-kinesis-video');
const { KinesisVideoMediaClient, GetMediaCommand } = require('@aws-sdk/client-kinesis-video-media');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const kinesisVideo = new KinesisVideoClient({});
const s3 = new S3Client({});
const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const lambda = new LambdaClient({});

const VIDEO_STREAM_NAME = process.env.VIDEO_STREAM_NAME;
const VIDEO_BUCKET = process.env.VIDEO_BUCKET;
const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const VIDEO_ANALYSIS_FUNCTION = process.env.VIDEO_ANALYSIS_FUNCTION_NAME;

/**
 * Processes Kinesis Video Stream data and extracts video segments for analysis
 */
exports.handler = async (event) => {
  console.log('Kinesis Video Stream event:', JSON.stringify(event, null, 2));
  
  try {
    // Handle different event types
    if (event.source === 'aws.kinesisvideo') {
      // Handle Kinesis Video Stream events
      return await handleKinesisVideoEvent(event);
    } else if (event.streamName) {
      // Direct invocation with stream name
      return await processVideoStream(event.streamName, event.startTime, event.endTime);
    } else {
      // Manual invocation for testing
      return await processVideoStream(VIDEO_STREAM_NAME);
    }
  } catch (error) {
    console.error('Error processing Kinesis Video Stream:', error);
    return {
      statusCode: 500,
      body: {
        message: 'Error processing video stream',
        error: error.message
      }
    };
  }
};

/**
 * Handle Kinesis Video Stream CloudWatch events
 */
async function handleKinesisVideoEvent(event) {
  console.log('Processing Kinesis Video Stream event...');
  
  const streamName = event.detail?.streamName || VIDEO_STREAM_NAME;
  const eventType = event.detail?.eventType;
  
  if (eventType === 'STREAM_CREATED' || eventType === 'PUT_MEDIA') {
    // Process the stream when new media is added
    return await processVideoStream(streamName);
  }
  
  return {
    statusCode: 200,
    body: {
      message: 'Event processed',
      eventType,
      streamName
    }
  };
}

/**
 * Process video stream and extract segments for analysis
 */
async function processVideoStream(streamName, startTime, endTime) {
  console.log(`Processing video stream: ${streamName}`);
  
  try {
    // Get stream information
    const streamInfo = await getStreamInfo(streamName);
    console.log('Stream info:', streamInfo);
    
    // Get data endpoint for media retrieval
    const dataEndpoint = await getDataEndpoint(streamName);
    console.log('Data endpoint:', dataEndpoint);
    
    // Extract video segments (for demo, we'll create mock segments)
    const segments = await extractVideoSegments(streamName, dataEndpoint, startTime, endTime);
    
    // Store segments in S3 and metadata in DynamoDB
    const processedSegments = [];
    for (const segment of segments) {
      const s3Key = await storeVideoSegment(segment);
      const metadata = await storeSegmentMetadata(segment, s3Key);
      
      // NEW: Trigger Rekognition analysis via existing video analysis Lambda
      const analysisResult = await triggerVideoAnalysis(s3Key, metadata);
      
      processedSegments.push({ 
        ...segment, 
        s3Key, 
        metadata,
        analysisTriggered: analysisResult.analysisTriggered,
        analysisJobId: analysisResult.jobId
      });
    }
    
    return {
      statusCode: 200,
      body: {
        message: 'Video stream processed successfully',
        streamName,
        segmentsProcessed: processedSegments.length,
        segments: processedSegments
      }
    };
  } catch (error) {
    console.error('Error processing video stream:', error);
    throw error;
  }
}

/**
 * Get stream information
 */
async function getStreamInfo(streamName) {
  const command = new DescribeStreamCommand({
    StreamName: streamName
  });
  
  const response = await kinesisVideo.send(command);
  return response.StreamInfo;
}

/**
 * Get data endpoint for media retrieval
 */
async function getDataEndpoint(streamName) {
  const command = new DescribeStreamCommand({
    StreamName: streamName
  });
  
  const response = await kinesisVideo.send(command);
  return response.StreamInfo?.DataEndpoint;
}

/**
 * Extract video segments from the stream
 * For demo purposes, this creates mock segments
 */
async function extractVideoSegments(streamName, dataEndpoint, startTime, endTime) {
  console.log('Extracting video segments...');
  
  // In a real implementation, you would:
  // 1. Use KinesisVideoMediaClient to get actual video data
  // 2. Process the video stream in real-time
  // 3. Identify interesting segments based on timing or content
  
  // For demo, create mock segments
  const now = new Date();
  const segments = [
    {
      segmentId: `segment-${now.getTime()}-1`,
      streamName,
      startTime: startTime || new Date(now.getTime() - 30000).toISOString(), // 30 seconds ago
      endTime: endTime || now.toISOString(),
      duration: 30,
      type: 'live-segment',
      quality: 'HD',
      size: 1024 * 1024 * 5 // 5MB mock size
    }
  ];
  
  return segments;
}

/**
 * Store video segment in S3
 * For demo: stores JSON metadata that mimics a video file
 * In production: would store actual video data extracted from Kinesis
 */
async function storeVideoSegment(segment) {
  const key = `live-streams/${segment.streamName}/${segment.segmentId}.mp4`;
  
  // Enhanced mock data that represents what would be extracted from Kinesis
  const mockVideoData = JSON.stringify({
    segmentId: segment.segmentId,
    streamName: segment.streamName,
    startTime: segment.startTime,
    endTime: segment.endTime,
    duration: segment.duration,
    type: segment.type,
    quality: segment.quality,
    size: segment.size,
    message: 'Mock video segment - represents extracted Kinesis data',
    // Add metadata that Rekognition can work with
    videoMetadata: {
      codec: 'H.264',
      resolution: segment.quality === 'HD' ? '1280x720' : '854x480',
      frameRate: 30,
      bitrate: segment.quality === 'HD' ? 2000000 : 1000000
    },
    // Flag for processing pipeline
    readyForAnalysis: true,
    source: 'kinesis-video-streams'
  });
  
  const command = new PutObjectCommand({
    Bucket: VIDEO_BUCKET,
    Key: key,
    Body: mockVideoData,
    ContentType: 'application/json', // In production: 'video/mp4'
    Metadata: {
      'segment-id': segment.segmentId,
      'stream-name': segment.streamName,
      'duration': segment.duration.toString(),
      'type': segment.type,
      'source': 'kinesis',
      'ready-for-analysis': 'true'
    }
  });
  
  await s3.send(command);
  console.log(`Stored video segment: ${key}`);
  
  return key;
}

/**
 * Store segment metadata in DynamoDB
 */
async function storeSegmentMetadata(segment, s3Key) {
  const timestamp = new Date().toISOString();
  const segmentId = `live-${segment.segmentId}`;
  
  const metadata = {
    highlightId: segmentId,
    timestamp,
    gameId: `live-stream-${segment.streamName}`,
    title: `Live Stream Segment`,
    description: `Real-time segment from ${segment.streamName}`,
    startTime: segment.startTime,
    endTime: segment.endTime,
    duration: segment.duration,
    videoUrl: `s3://${VIDEO_BUCKET}/${s3Key}`,
    source: 'kinesis-video-stream',
    streamName: segment.streamName,
    segmentType: segment.type,
    quality: segment.quality,
    size: segment.size,
    processed: false,
    aiEnhanced: false,
    excitementLevel: 5, // Default level, will be updated by AI analysis
    confidence: 80 // Default confidence for live streams
  };
  
  const command = new PutCommand({
    TableName: HIGHLIGHTS_TABLE,
    Item: metadata
  });
  
  await dynamoDB.send(command);
  console.log(`Stored segment metadata: ${segmentId}`);
  
  return metadata;
}

/**
 * Trigger downstream processing for the video segment
 * NOW ACTUALLY INVOKES THE VIDEO ANALYSIS LAMBDA!
 */
async function triggerVideoAnalysis(s3Key, segmentMetadata) {
  console.log(`Triggering video analysis for: ${s3Key}`);
  console.log('Segment metadata:', segmentMetadata);
  
  try {
    // Extract bucket and key from S3 path
    const bucket = VIDEO_BUCKET;
    const key = s3Key;
    
    // Prepare payload for video analysis Lambda
    const payload = {
      bucket: bucket,
      key: key,
      source: 'kinesis-video-streams',
      segmentId: segmentMetadata.highlightId,
      streamName: segmentMetadata.streamName,
      // Pass additional context for Kinesis-sourced content
      kinesisMetadata: {
        segmentDuration: segmentMetadata.duration,
        streamTimestamp: segmentMetadata.timestamp,
        isLiveSegment: true
      }
    };
    
    // Invoke the existing video analysis Lambda function
    const command = new InvokeCommand({
      FunctionName: VIDEO_ANALYSIS_FUNCTION,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify(payload)
    });
    
    const response = await lambda.send(command);
    
    console.log(`Video analysis triggered successfully for ${s3Key}`);
    console.log('Lambda invocation response:', {
      statusCode: response.StatusCode,
      executedVersion: response.ExecutedVersion
    });
    
    return {
      analysisTriggered: true,
      s3Key,
      segmentId: segmentMetadata.highlightId,
      jobId: `kinesis-analysis-${segmentMetadata.highlightId}`,
      lambdaResponse: {
        statusCode: response.StatusCode,
        executedVersion: response.ExecutedVersion
      }
    };
    
  } catch (error) {
    console.error('Error triggering video analysis:', error);
    
    // Return partial success - segment was stored but analysis failed
    return {
      analysisTriggered: false,
      s3Key,
      segmentId: segmentMetadata.highlightId,
      error: error.message,
      fallbackMessage: 'Segment stored successfully, but analysis trigger failed'
    };
  }
}
