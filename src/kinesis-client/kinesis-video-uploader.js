/**
 * Kinesis Video Streams Client for uploading gaming videos
 * This can be used in web browsers or Node.js applications
 */

class KinesisVideoUploader {
  constructor(config) {
    this.streamName = config.streamName;
    this.region = config.region || 'us-east-1';
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;
    this.sessionToken = config.sessionToken; // Optional for temporary credentials
    
    this.isStreaming = false;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }

  /**
   * Initialize the Kinesis Video client
   */
  async initialize() {
    try {
      // Import AWS SDK (works in both browser and Node.js)
      if (typeof window !== 'undefined') {
        // Browser environment
        this.AWS = window.AWS;
      } else {
        // Node.js environment
        this.AWS = require('aws-sdk');
      }

      // Configure AWS credentials
      this.AWS.config.update({
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        sessionToken: this.sessionToken,
        region: this.region
      });

      this.kinesisVideo = new this.AWS.KinesisVideo();
      this.kinesisVideoMedia = new this.AWS.KinesisVideoMedia();

      console.log('Kinesis Video client initialized');
      return true;
    } catch (error) {
      console.error('Error initializing Kinesis Video client:', error);
      throw error;
    }
  }

  /**
   * Start streaming video from webcam or screen capture
   */
  async startLiveStream(constraints = { video: true, audio: true }) {
    try {
      console.log('Starting live stream...');

      // Get media stream from user's camera/screen
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create MediaRecorder for capturing video chunks
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2000000 // 2 Mbps
      });

      this.recordedChunks = [];
      this.isStreaming = true;

      // Handle data available event
      this.mediaRecorder.ondataavailable = async (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          
          // Send chunk to Kinesis Video Streams
          await this.sendVideoChunk(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        console.log('Live stream stopped');
        this.isStreaming = false;
      };

      // Start recording in chunks (every 5 seconds)
      this.mediaRecorder.start(5000);

      console.log('Live streaming started');
      return stream;
    } catch (error) {
      console.error('Error starting live stream:', error);
      throw error;
    }
  }

  /**
   * Upload a video file to Kinesis Video Streams
   */
  async uploadVideoFile(file) {
    try {
      console.log(`Uploading video file: ${file.name}`);

      // Convert file to ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Get data endpoint for the stream
      const dataEndpoint = await this.getDataEndpoint();
      
      // Configure KinesisVideoMedia client with data endpoint
      this.kinesisVideoMedia.endpoint = dataEndpoint;

      // Upload video data
      const params = {
        StreamName: this.streamName,
        Payload: uint8Array,
        ProducerStartTimestamp: new Date()
      };

      const result = await this.kinesisVideoMedia.putMedia(params).promise();
      console.log('Video uploaded successfully:', result);

      return result;
    } catch (error) {
      console.error('Error uploading video file:', error);
      throw error;
    }
  }

  /**
   * Send video chunk to Kinesis Video Streams
   */
  async sendVideoChunk(chunk) {
    try {
      // Convert blob to ArrayBuffer
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Get data endpoint if not already obtained
      if (!this.dataEndpoint) {
        this.dataEndpoint = await this.getDataEndpoint();
        this.kinesisVideoMedia.endpoint = this.dataEndpoint;
      }

      // Send chunk to Kinesis Video Streams
      const params = {
        StreamName: this.streamName,
        Payload: uint8Array,
        ProducerStartTimestamp: new Date()
      };

      await this.kinesisVideoMedia.putMedia(params).promise();
      console.log('Video chunk sent to Kinesis');
    } catch (error) {
      console.error('Error sending video chunk:', error);
      // Don't throw error to avoid stopping the stream
    }
  }

  /**
   * Get data endpoint for the Kinesis Video Stream
   */
  async getDataEndpoint() {
    try {
      const params = {
        StreamName: this.streamName,
        APIName: 'PUT_MEDIA'
      };

      const result = await this.kinesisVideo.getDataEndpoint(params).promise();
      console.log('Data endpoint obtained:', result.DataEndpoint);
      
      return result.DataEndpoint;
    } catch (error) {
      console.error('Error getting data endpoint:', error);
      throw error;
    }
  }

  /**
   * Stop live streaming
   */
  stopLiveStream() {
    if (this.mediaRecorder && this.isStreaming) {
      this.mediaRecorder.stop();
      
      // Stop all tracks
      if (this.mediaRecorder.stream) {
        this.mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
      
      this.isStreaming = false;
      console.log('Live streaming stopped');
    }
  }

  /**
   * Get stream status
   */
  getStreamStatus() {
    return {
      isStreaming: this.isStreaming,
      streamName: this.streamName,
      chunksRecorded: this.recordedChunks.length
    };
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KinesisVideoUploader;
} else if (typeof window !== 'undefined') {
  window.KinesisVideoUploader = KinesisVideoUploader;
}

// Usage example:
/*
const uploader = new KinesisVideoUploader({
  streamName: 'game-highlights-stream-123456789',
  region: 'us-east-1',
  accessKeyId: 'USE_STS_TEMPORARY_CREDENTIALS',
  secretAccessKey: 'NEVER_USE_PERMANENT_CREDENTIALS',
  sessionToken: 'REQUIRED_FOR_SECURITY'
});

// Initialize
await uploader.initialize();

// Start live streaming
const stream = await uploader.startLiveStream();

// Or upload a file
const fileInput = document.getElementById('video-file');
fileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  await uploader.uploadVideoFile(file);
});

// Stop streaming
uploader.stopLiveStream();
*/
