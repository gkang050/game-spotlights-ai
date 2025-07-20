# Game Spotlights AI

Real-time personalized game highlights generation using AWS AI/ML services.

## Overview

Game Spotlights AI automatically analyzes live sports footage, identifies key moments, and creates personalized highlight reels tailored to individual user preferences. The system leverages AWS's powerful AI and ML services to deliver a seamless, scalable solution for sports broadcasters, streaming platforms, and fans.

## Key Features

- **Real-time video analysis** using computer vision and ML
- **Personalized highlights** based on user preferences
- **Multi-sport support** with customizable detection models
- **Scalable architecture** to handle multiple concurrent games
- **Low-latency delivery** of highlights to users
- **User preference learning** that improves over time

## Architecture

This project uses a serverless, event-driven architecture built on AWS services:

- **Video Processing**: Amazon Kinesis Video Streams, AWS MediaLive, Amazon S3
- **AI/ML Analysis**: Amazon Rekognition, Amazon Bedrock, Amazon SageMaker
- **Personalization**: Amazon Personalize, Amazon Comprehend
- **Processing**: AWS Lambda, AWS Step Functions, Amazon EventBridge
- **Storage**: Amazon DynamoDB, Amazon OpenSearch Service
- **Delivery**: Amazon CloudFront, AWS MediaPackage
- **User Management**: Amazon Cognito, AWS AppSync
- **Frontend**: AWS Amplify

See [architecture.md](architecture.md) for detailed architecture diagrams and information.

## Getting Started

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Node.js 18+ and npm/yarn
- Python 3.8+ (for ML components)
- Docker (optional, for local development)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/game-spotlights-ai.git
   cd game-spotlights-ai
   ```

2. Deploy the infrastructure:
   ```
   cd infrastructure
   npm install
   npm run deploy
   ```

3. Set up the frontend:
   ```
   cd ../frontend
   npm install
   npm run build
   ```

4. Train the ML models (optional):
   ```
   cd ../ml
   pip install -r requirements.txt
   python train.py
   ```

## Project Structure

```
game-spotlights-ai/
├── infrastructure/       # AWS CDK code for infrastructure
├── backend/             # Lambda functions and backend services
├── frontend/            # Web application
├── ml/                  # Machine learning models and training
├── docs/                # Documentation
└── scripts/             # Utility scripts
```

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- AWS for providing the cloud infrastructure and AI services
- Sports data providers for game statistics and information