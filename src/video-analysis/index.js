const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// Configure AWS Bedrock client when available in your region
// const bedrockRuntime = new AWS.BedrockRuntime();

const HIGHLIGHTS_TABLE = process.env.HIGHLIGHTS_TABLE;

/**
 * Analyzes video content using AWS Rekognition and Bedrock
 * to identify potential highlight moments
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  try {
    // Extract video information from the event
    const bucket = event.bucket || event.detail?.bucket?.name;
    const key = event.key || event.detail?.object?.key;
    
    if (!bucket || !key) {
      throw new Error('Missing bucket or key information');
    }
    
    console.log(`Processing video from ${bucket}/${key}`);
    
    // Start label detection job
    const labelDetectionResponse = await startLabelDetection(bucket, key);
    const labelJobId = labelDetectionResponse.JobId;
    
    // Wait for label detection to complete
    const labelResults = await waitForJobCompletion('label', labelJobId);
    
    // Start person tracking job
    const personTrackingResponse = await startPersonTracking(bucket, key);
    const personJobId = personTrackingResponse.JobId;
    
    // Wait for person tracking to complete
    const personResults = await waitForJobCompletion('person', personJobId);
    
    // Analyze results to find potential highlights
    const potentialHighlights = analyzeResults(labelResults, personResults);
    
    // Store highlight metadata
    await storeHighlightMetadata(bucket, key, potentialHighlights);
    
    return {
      statusCode: 200,
      body: {
        message: 'Video analysis completed successfully',
        videoKey: key,
        highlightsCount: potentialHighlights.length,
        highlights: potentialHighlights
      }
    };
  } catch (error) {
    console.error('Error processing video:', error);
    
    return {
      statusCode: 500,
      body: {
        message: 'Error processing video',
        error: error.message
      }
    };
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
  
  return await rekognition.startLabelDetection(params).promise();
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
  
  return await rekognition.startPersonTracking(params).promise();
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
      response = await rekognition.getLabelDetection({ JobId: jobId }).promise();
    } else if (jobType === 'person') {
      response = await rekognition.getPersonTracking({ JobId: jobId }).promise();
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
          processed: false
        }
      }
    };
  });
  
  // Batch write to DynamoDB
  for (let i = 0; i < putRequests.length; i += 25) {
    const batch = putRequests.slice(i, i + 25);
    
    await dynamoDB.batchWrite({
      RequestItems: {
        [HIGHLIGHTS_TABLE]: batch
      }
    }).promise();
  }
}

/**
 * Extract game ID from S3 key
 */
function extractGameIdFromKey(key) {
  // Assuming key format: games/GAME_ID/video.mp4
  const parts = key.split('/');
  return parts.length >= 2 ? parts[1] : 'unknown-game';
}