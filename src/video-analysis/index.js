const { RekognitionClient, StartLabelDetectionCommand, StartPersonTrackingCommand, GetLabelDetectionCommand, GetPersonTrackingCommand } = require('@aws-sdk/client-rekognition');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client } = require('@aws-sdk/client-s3');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { ComprehendClient, DetectSentimentCommand, DetectEntitiesCommand, DetectKeyPhrasesCommand } = require('@aws-sdk/client-comprehend');

const rekognition = new RekognitionClient({});
const dynamoClient = new DynamoDBClient({});
const dynamoDB = DynamoDBDocumentClient.from(dynamoClient);
const s3 = new S3Client({});
const bedrockRuntime = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});
const comprehend = new ComprehendClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Environment variable validation
const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

// Validate required environment variables
if (!HIGHLIGHTS_TABLE) {
  throw new Error('HIGHLIGHTS_TABLE environment variable is required');
}

/**
 * Analyzes video content using AWS Rekognition and Bedrock
 * to identify potential highlight moments
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Input validation and sanitization
    const bucket = event.bucket || event.detail?.bucket?.name;
    const key = event.key || event.detail?.object?.key;
    const source = event.source || 'direct-upload';
    const isKinesisSegment = source === 'kinesis-video-streams';
    
    // Validate required parameters
    if (!bucket || typeof bucket !== 'string' || bucket.trim() === '') {
      throw new Error('Invalid or missing bucket name');
    }
    
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('Invalid or missing object key');
    }
    
    // Sanitize inputs
    const sanitizedBucket = bucket.trim();
    const sanitizedKey = key.trim();
    
    // Validate file extension for security
    if (!isKinesisSegment && !sanitizedKey.toLowerCase().endsWith('.mp4')) {
      throw new Error('Only MP4 files are supported for direct uploads');
    }
    
    // Validate S3 key format to prevent path traversal
    if (sanitizedKey.includes('..') || sanitizedKey.startsWith('/')) {
      throw new Error('Invalid file path detected');
    }
    
    console.log(`Processing video from ${sanitizedBucket}/${sanitizedKey} (source: ${source})`);
    
    // Handle Kinesis segments differently
    if (isKinesisSegment) {
      console.log('Processing Kinesis Video Stream segment');
      console.log('Kinesis metadata:', event.kinesisMetadata);
      
      // For demo: Kinesis segments are JSON files, not actual video
      // In production, these would be real video segments
      if (key.includes('live-streams/')) {
        console.log('Note: Processing mock Kinesis segment for demo purposes');
        return await processMockKinesisSegment(sanitizedBucket, sanitizedKey, event);
      }
    }
    
    // Start label detection job
    const labelDetectionResponse = await startLabelDetection(sanitizedBucket, sanitizedKey);
    const labelJobId = labelDetectionResponse.JobId;
    
    // Wait for label detection to complete
    const labelResults = await waitForJobCompletion('label', labelJobId);
    
    // Start person tracking job
    const personTrackingResponse = await startPersonTracking(sanitizedBucket, sanitizedKey);
    const personJobId = personTrackingResponse.JobId;
    
    // Wait for person tracking to complete
    const personResults = await waitForJobCompletion('person', personJobId);
    
    // Analyze results to find potential highlights
    const potentialHighlights = analyzeResults(labelResults, personResults);
    
    // Enhance highlights with Bedrock AI analysis
    const enhancedHighlights = await enhanceWithBedrock(potentialHighlights, sanitizedBucket, sanitizedKey);
    
    // Further enhance with Comprehend text analysis
    const comprehendEnhancedHighlights = await enhanceWithComprehend(enhancedHighlights);
    
    // Store highlight metadata
    await storeHighlightMetadata(sanitizedBucket, sanitizedKey, comprehendEnhancedHighlights);
    
    // Note: Clip generation will be triggered automatically by DynamoDB stream
    console.log(`Stored ${comprehendEnhancedHighlights.length} highlights. Clip generation will be triggered by DynamoDB stream.`);
    
    return {
      statusCode: 200,
      body: {
        message: 'Video analysis completed successfully',
        videoKey: key,
        highlightsCount: potentialHighlights.length,
        highlights: comprehendEnhancedHighlights,
        clipGenerationNote: 'Clip generation triggered via DynamoDB stream'
      }
    };
  } catch (error) {
    console.error('Error processing video:', {
      error: error.message,
      stack: error.stack,
      bucket: event.bucket,
      key: event.key,
      source: event.source,
      timestamp: new Date().toISOString()
    });
    
    // Return structured error response
    const errorResponse = {
      statusCode: error.name === 'ValidationError' ? 400 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        error: true,
        message: 'Video processing failed',
        details: error.message,
        timestamp: new Date().toISOString(),
        requestId: event.requestContext?.requestId || 'unknown',
        service: 'video-analysis'
      })
    };
    
    return errorResponse;
  }
};

/**
 * Start label detection job in Rekognition
 */
async function startLabelDetection(bucket, key) {
  const params = {
    Video: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    },
    MinConfidence: 70
  };
  
  return await rekognition.send(new StartLabelDetectionCommand(params));
}

/**
 * Start person tracking job in Rekognition
 */
async function startPersonTracking(bucket, key) {
  const params = {
    Video: {
      S3Object: {
        Bucket: bucket,
        Name: key
      }
    }
  };
  
  return await rekognition.send(new StartPersonTrackingCommand(params));
}

/**
 * Wait for Rekognition job to complete
 */
async function waitForJobCompletion(jobType, jobId) {
  let jobCompleted = false;
  let results;
  
  while (!jobCompleted) {
    let response;
    
    if (jobType === 'label') {
      response = await rekognition.send(new GetLabelDetectionCommand({ JobId: jobId }));
    } else if (jobType === 'person') {
      response = await rekognition.send(new GetPersonTrackingCommand({ JobId: jobId }));
    }
    
    jobCompleted = response.JobStatus === 'SUCCEEDED';
    
    if (jobCompleted) {
      results = response;
    } else if (response.JobStatus === 'FAILED') {
      throw new Error(`${jobType} detection job failed`);
    } else {
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  return results;
}

/**
 * Analyze Rekognition results to identify potential highlights
 */
function analyzeResults(labelResults, personResults) {
  const potentialHighlights = [];
  const interestingLabels = ['Ball', 'Sports', 'Goal', 'Celebration', 'Person', 'Crowd'];
  const labelTimestamps = {};
  
  // Process label results
  if (labelResults && labelResults.Labels) {
    labelResults.Labels.forEach(label => {
      if (interestingLabels.includes(label.Label.Name) && label.Confidence > 85) {
        const timestamp = label.Timestamp;
        
        if (!labelTimestamps[timestamp]) {
          labelTimestamps[timestamp] = [];
        }
        
        labelTimestamps[timestamp].push({
          name: label.Label.Name,
          confidence: label.Confidence
        });
      }
    });
  }
  
  // Find clusters of interesting events
  const timestamps = Object.keys(labelTimestamps).map(Number).sort((a, b) => a - b);
  let currentCluster = [];
  let lastTimestamp = 0;
  
  timestamps.forEach(timestamp => {
    if (currentCluster.length === 0 || timestamp - lastTimestamp < 5000) {
      // Add to current cluster if within 5 seconds
      currentCluster.push(timestamp);
    } else {
      // Process the completed cluster
      if (currentCluster.length >= 3) {
        const startTime = currentCluster[0];
        const endTime = currentCluster[currentCluster.length - 1];
        
        potentialHighlights.push({
          startTime: startTime / 1000, // Convert to seconds
          endTime: endTime / 1000,
          duration: (endTime - startTime) / 1000,
          confidence: calculateClusterConfidence(currentCluster, labelTimestamps),
          labels: getUniqueLabels(currentCluster, labelTimestamps)
        });
      }
      
      // Start a new cluster
      currentCluster = [timestamp];
    }
    
    lastTimestamp = timestamp;
  });
  
  // Process the last cluster
  if (currentCluster.length >= 3) {
    const startTime = currentCluster[0];
    const endTime = currentCluster[currentCluster.length - 1];
    
    potentialHighlights.push({
      startTime: startTime / 1000,
      endTime: endTime / 1000,
      duration: (endTime - startTime) / 1000,
      confidence: calculateClusterConfidence(currentCluster, labelTimestamps),
      labels: getUniqueLabels(currentCluster, labelTimestamps)
    });
  }
  
  // Enhance with person tracking data
  enhanceWithPersonData(potentialHighlights, personResults);
  
  // Sort by confidence
  return potentialHighlights.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Calculate confidence score for a cluster of events
 */
function calculateClusterConfidence(cluster, labelTimestamps) {
  let totalConfidence = 0;
  let count = 0;
  
  cluster.forEach(timestamp => {
    labelTimestamps[timestamp].forEach(label => {
      totalConfidence += label.confidence;
      count++;
    });
  });
  
  return count > 0 ? totalConfidence / count : 0;
}

/**
 * Get unique labels from a cluster of events
 */
function getUniqueLabels(cluster, labelTimestamps) {
  const uniqueLabels = new Set();
  
  cluster.forEach(timestamp => {
    labelTimestamps[timestamp].forEach(label => {
      uniqueLabels.add(label.name);
    });
  });
  
  return Array.from(uniqueLabels);
}

/**
 * Enhance highlight data with person tracking information
 */
function enhanceWithPersonData(highlights, personResults) {
  if (!personResults || !personResults.Persons) {
    return;
  }
  
  highlights.forEach(highlight => {
    const startTimeMs = highlight.startTime * 1000;
    const endTimeMs = highlight.endTime * 1000;
    const personsInHighlight = personResults.Persons.filter(
      person => person.Timestamp >= startTimeMs && person.Timestamp <= endTimeMs
    );
    
    // Count unique persons
    const uniquePersonIds = new Set();
    personsInHighlight.forEach(person => {
      if (person.Person && person.Person.Index) {
        uniquePersonIds.add(person.Person.Index);
      }
    });
    
    highlight.personCount = uniquePersonIds.size;
    
    // Adjust confidence based on person count
    if (highlight.personCount > 5) {
      highlight.confidence *= 1.2; // Boost confidence for scenes with many people
    }
  });
}

/**
 * Store highlight metadata in DynamoDB
 */
async function storeHighlightMetadata(bucket, key, highlights) {
  const gameId = extractGameIdFromKey(key);
  const timestamp = new Date().toISOString();
  
  const putRequests = highlights.map((highlight, index) => {
    const highlightId = `${gameId}-${timestamp}-${index}`;
    
    return {
      PutRequest: {
        Item: {
          highlightId,
          timestamp,
          gameId,
          sourceVideo: `s3://${bucket}/${key}`,
          startTime: highlight.startTime,
          endTime: highlight.endTime,
          duration: highlight.duration,
          confidence: highlight.confidence,
          labels: highlight.labels,
          personCount: highlight.personCount || 0,
          excitementLevel: highlight.excitementLevel || 5,
          playType: highlight.playType || 'general',
          aiTitle: highlight.aiTitle || `Highlight ${index + 1}`,
          aiEnhanced: highlight.aiEnhanced || false,
          comprehendEnhanced: highlight.comprehendEnhanced || false,
          titleSentiment: highlight.titleSentiment,
          titleEntities: highlight.titleEntities,
          titleKeyPhrases: highlight.titleKeyPhrases,
          gamingContext: highlight.gamingContext,
          processed: true,
          clipGenerated: false,
          clipStatus: 'pending'
        }
      }
    };
  });
  
  // Batch write to DynamoDB
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    
    await dynamoDB.send(new BatchWriteCommand({
      RequestItems: {
        [HIGHLIGHTS_TABLE]: batch
      }
    }));
  }
}

/**
 * Enhance highlights using Amazon Bedrock for contextual understanding
 */
async function enhanceWithBedrock(highlights, bucket, key) {
  try {
    // Prepare context for Bedrock analysis
    const gameContext = {
      videoSource: `s3://${bucket}/${key}`,
      gameType: extractGameTypeFromKey(key),
      highlights: highlights.map(h => ({
        startTime: h.startTime,
        duration: h.duration,
        labels: h.labels,
        confidence: h.confidence
      }))
    };

    // Use Claude 3 Haiku for fast, cost-effective analysis
    const prompt = `Analyze these gaming video highlights and provide enhanced context:

Game Context: ${JSON.stringify(gameContext, null, 2)}

For each highlight, provide:
1. Excitement level (1-10)
2. Play type classification (goal, save, skill move, celebration, etc.)
3. Recommended title
4. Target audience appeal

Respond in JSON format with enhanced metadata for each highlight.`;

    const params = {
      modelId: BEDROCK_MODEL_ID,
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    };

    console.log('Calling Bedrock for highlight enhancement...');
    const response = await bedrockRuntime.send(new InvokeModelCommand(params));
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    
    if (responseBody.content && responseBody.content[0] && responseBody.content[0].text) {
      const aiAnalysis = JSON.parse(responseBody.content[0].text);
      
      // Merge AI insights with existing highlights
      return highlights.map((highlight, index) => {
        const aiInsight = aiAnalysis.highlights?.[index] || {};
        return {
          ...highlight,
          excitementLevel: aiInsight.excitementLevel || highlight.confidence / 10,
          playType: aiInsight.playType || 'general',
          aiTitle: aiInsight.title || `Highlight ${index + 1}`,
          targetAudience: aiInsight.targetAudience || 'general',
          aiEnhanced: true
        };
      });
    }
  } catch (error) {
    console.warn('Bedrock enhancement failed, using original highlights:', error.message);
    // Return original highlights with basic AI enhancement flag
    return highlights.map(highlight => ({
      ...highlight,
      aiEnhanced: false,
      excitementLevel: highlight.confidence / 10,
      playType: 'detected',
      aiTitle: `Auto-detected Highlight`
    }));
  }
  
  return highlights;
}

/**
 * Extract game type from S3 key for better context
 */
function extractGameTypeFromKey(key) {
  const keyLower = key.toLowerCase();
  if (keyLower.includes('soccer') || keyLower.includes('football')) return 'soccer';
  if (keyLower.includes('basketball')) return 'basketball';
  if (keyLower.includes('tennis')) return 'tennis';
  if (keyLower.includes('hockey')) return 'hockey';
  if (keyLower.includes('baseball')) return 'baseball';
  return 'general_sports';
}

/**
 * Extract game ID from S3 key
 */
function extractGameIdFromKey(key) {
  // Assuming key format: games/GAME_ID/video.mp4
  const parts = key.split('/');
  return parts.length >= 2 ? parts[1] : 'unknown-game';
}

/**
 * Enhance highlights with Amazon Comprehend text analysis
 */
async function enhanceWithComprehend(highlights) {
  console.log('Enhancing highlights with Comprehend text analysis...');
  
  try {
    const enhancedHighlights = [];
    
    for (const highlight of highlights) {
      const enhanced = { ...highlight };
      
      // Analyze the AI-generated title with Comprehend
      if (highlight.aiTitle) {
        const titleAnalysis = await analyzeTextWithComprehend(highlight.aiTitle);
        enhanced.titleSentiment = titleAnalysis.sentiment;
        enhanced.titleEntities = titleAnalysis.entities;
        enhanced.titleKeyPhrases = titleAnalysis.keyPhrases;
      }
      
      // Analyze the description if available
      if (highlight.description) {
        const descriptionAnalysis = await analyzeTextWithComprehend(highlight.description);
        enhanced.descriptionSentiment = descriptionAnalysis.sentiment;
        enhanced.descriptionEntities = descriptionAnalysis.entities;
      }
      
      // Generate gaming-specific sentiment context
      enhanced.gamingContext = generateGamingContext(enhanced);
      enhanced.comprehendEnhanced = true;
      
      enhancedHighlights.push(enhanced);
    }
    
    console.log(`Enhanced ${enhancedHighlights.length} highlights with Comprehend analysis`);
    return enhancedHighlights;
    
  } catch (error) {
    console.warn('Comprehend enhancement failed, using original highlights:', error.message);
    return highlights.map(highlight => ({
      ...highlight,
      comprehendEnhanced: false
    }));
  }
}

/**
 * Analyze text with Amazon Comprehend
 */
async function analyzeTextWithComprehend(text) {
  try {
    const analysis = {
      sentiment: null,
      entities: [],
      keyPhrases: []
    };
    
    // Detect sentiment
    const sentimentCommand = new DetectSentimentCommand({
      Text: text,
      LanguageCode: 'en'
    });
    const sentimentResult = await comprehend.send(sentimentCommand);
    analysis.sentiment = {
      sentiment: sentimentResult.Sentiment,
      confidence: sentimentResult.SentimentScore[sentimentResult.Sentiment]
    };
    
    // Detect entities
    const entitiesCommand = new DetectEntitiesCommand({
      Text: text,
      LanguageCode: 'en'
    });
    const entitiesResult = await comprehend.send(entitiesCommand);
    analysis.entities = entitiesResult.Entities.map(entity => ({
      text: entity.Text,
      type: entity.Type,
      confidence: entity.Score
    }));
    
    // Detect key phrases
    const keyPhrasesCommand = new DetectKeyPhrasesCommand({
      Text: text,
      LanguageCode: 'en'
    });
    const keyPhrasesResult = await comprehend.send(keyPhrasesCommand);
    analysis.keyPhrases = keyPhrasesResult.KeyPhrases.map(phrase => ({
      text: phrase.Text,
      confidence: phrase.Score
    }));
    
    return analysis;
    
  } catch (error) {
    console.error('Error analyzing text with Comprehend:', error);
    return {
      sentiment: null,
      entities: [],
      keyPhrases: []
    };
  }
}

/**
 * Generate gaming-specific context based on Comprehend analysis
 */
function generateGamingContext(highlight) {
  const context = {
    emotionalTone: 'neutral',
    gameplayType: 'general',
    audienceAppeal: 'broad'
  };
  
  // Analyze sentiment for emotional tone
  if (highlight.titleSentiment) {
    const sentiment = highlight.titleSentiment.sentiment;
    const confidence = highlight.titleSentiment.confidence;
    
    if (confidence > 0.7) {
      switch (sentiment) {
        case 'POSITIVE':
          context.emotionalTone = 'exciting';
          break;
        case 'NEGATIVE':
          context.emotionalTone = 'intense';
          break;
        case 'NEUTRAL':
          context.emotionalTone = 'balanced';
          break;
      }
    }
  }
  
  // Analyze entities for gameplay type
  if (highlight.titleEntities && highlight.titleEntities.length > 0) {
    const entities = highlight.titleEntities;
    
    // Look for sports/gaming related entities
    for (const entity of entities) {
      const text = entity.text.toLowerCase();
      if (text.includes('goal') || text.includes('score')) {
        context.gameplayType = 'scoring';
      } else if (text.includes('save') || text.includes('defense')) {
        context.gameplayType = 'defensive';
      } else if (text.includes('skill') || text.includes('move')) {
        context.gameplayType = 'technical';
      }
    }
  }
  
  // Determine audience appeal based on key phrases
  if (highlight.titleKeyPhrases && highlight.titleKeyPhrases.length > 0) {
    const phrases = highlight.titleKeyPhrases;
    let appealScore = 0;
    
    for (const phrase of phrases) {
      const text = phrase.text.toLowerCase();
      if (text.includes('epic') || text.includes('amazing') || text.includes('incredible')) {
        appealScore += 2;
      } else if (text.includes('great') || text.includes('good') || text.includes('nice')) {
        appealScore += 1;
      }
    }
    
    if (appealScore >= 3) {
      context.audienceAppeal = 'high';
    } else if (appealScore >= 1) {
      context.audienceAppeal = 'medium';
    }
  }
  
  return context;
}

/**
 * Process mock Kinesis segment for demo purposes
 * In production, this would process real video segments from Kinesis
 */
async function processMockKinesisSegment(bucket, key, event) {
  console.log('Processing mock Kinesis segment - simulating real-time analysis');
  
  try {
    // Create mock highlights based on Kinesis segment metadata
    const mockHighlights = [
      {
        startTime: 0,
        endTime: event.kinesisMetadata?.segmentDuration || 30,
        duration: event.kinesisMetadata?.segmentDuration || 30,
        confidence: 88.5,
        labels: ['Sports', 'Person', 'Action'],
        personCount: 2,
        excitementLevel: 7,
        playType: 'live-action',
        aiTitle: `Live Gaming Moment - ${new Date().toLocaleTimeString()}`,
        aiEnhanced: true,
        source: 'kinesis-video-streams',
        isLiveSegment: true,
        streamTimestamp: event.kinesisMetadata?.streamTimestamp
      }
    ];
    
    // Enhance with Bedrock for consistency
    const enhancedHighlights = await enhanceWithBedrock(mockHighlights, bucket, key);
    
    // Add Comprehend analysis
    const comprehendEnhancedHighlights = await enhanceWithComprehend(enhancedHighlights);
    
    // Store in DynamoDB with Kinesis-specific metadata
    await storeKinesisHighlightMetadata(bucket, key, comprehendEnhancedHighlights, event);
    
    return {
      statusCode: 200,
      body: {
        message: 'Kinesis video segment processed successfully',
        videoKey: key,
        source: 'kinesis-video-streams',
        segmentId: event.segmentId,
        streamName: event.streamName,
        highlightsCount: mockHighlights.length,
        highlights: comprehendEnhancedHighlights,
        processingNote: 'Mock processing - demonstrates Kinesis integration'
      }
    };
    
  } catch (error) {
    console.error('Error processing Kinesis segment:', error);
    return {
      statusCode: 500,
      body: {
        message: 'Error processing Kinesis segment',
        error: error.message,
        videoKey: key,
        source: 'kinesis-video-streams'
      }
    };
  }
}

/**
 * Store Kinesis-sourced highlight metadata with additional context
 */
async function storeKinesisHighlightMetadata(bucket, key, highlights, event) {
  const segmentId = event.segmentId || 'unknown-segment';
  const streamName = event.streamName || 'unknown-stream';
  const timestamp = new Date().toISOString();
  
  const putRequests = highlights.map((highlight, index) => {
    const highlightId = `kinesis-${segmentId}-${timestamp}-${index}`;
    
    return {
      PutRequest: {
        Item: {
          highlightId,
          timestamp,
          gameId: `live-${streamName}`,
          sourceVideo: `s3://${bucket}/${key}`,
          startTime: highlight.startTime,
          endTime: highlight.endTime,
          duration: highlight.duration,
          confidence: highlight.confidence,
          labels: highlight.labels,
          personCount: highlight.personCount || 0,
          excitementLevel: highlight.excitementLevel,
          playType: highlight.playType,
          aiTitle: highlight.aiTitle,
          aiEnhanced: highlight.aiEnhanced,
          comprehendEnhanced: highlight.comprehendEnhanced || false,
          // Kinesis-specific fields
          source: 'kinesis-video-streams',
          streamName: streamName,
          segmentId: segmentId,
          isLiveSegment: true,
          streamTimestamp: event.kinesisMetadata?.streamTimestamp,
          processed: true
        }
      }
    };
  });
  
  // Batch write to DynamoDB
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    
    await dynamoDB.send(new BatchWriteCommand({
      RequestItems: {
        [HIGHLIGHTS_TABLE]: batch
      }
    }));
  }
  
  console.log(`Stored ${highlights.length} Kinesis highlights in DynamoDB`);
}