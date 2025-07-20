# Contributing to Game Spotlights AI

Thank you for your interest in contributing to Game Spotlights AI! This document provides guidelines and instructions for contributing to this project.

## Development Setup

### Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- Node.js 18+ and npm/yarn
- Python 3.8+ (for ML components)
- Docker (optional, for local development)

### Local Development Environment

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/game-spotlights-ai.git
   cd game-spotlights-ai
   ```

2. Install dependencies:
   ```
   # Infrastructure
   cd infrastructure
   npm install
   cd ..
   
   # Backend (if needed)
   cd backend
   npm install
   cd ..
   ```

3. Set up local environment variables:
   ```
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Running Locally

For local development, you can use AWS SAM or LocalStack to emulate AWS services:

```
# Using AWS SAM
sam local start-api

# Using LocalStack
docker-compose up -d
```

## Project Structure

- `infrastructure/`: AWS CDK code for infrastructure
- `backend/`: Lambda functions and backend services
- `frontend/`: Web application (when added)
- `ml/`: Machine learning models and training code (when added)

## Coding Standards

### General Guidelines

- Follow the principle of least privilege for IAM roles
- Use environment variables for configuration
- Write unit tests for all code
- Document your code with comments and JSDoc/docstrings

### JavaScript/TypeScript

- Use ESLint for linting
- Follow the Airbnb JavaScript Style Guide
- Use async/await instead of callbacks or promises
- Use TypeScript for type safety when possible

### Infrastructure as Code

- Use AWS CDK for infrastructure definition
- Follow the principle of immutable infrastructure
- Use environment-specific configuration

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes and ensure tests pass
3. Update documentation as needed
4. Submit a pull request with a clear description of the changes
5. Address any feedback from code reviews

## Testing

- Write unit tests for all Lambda functions
- Test infrastructure changes using CDK diff
- Perform integration testing in a development environment

## Security

- Never commit AWS credentials or secrets
- Use AWS Secrets Manager or Parameter Store for sensitive information
- Follow AWS security best practices
- Regularly update dependencies to patch security vulnerabilities

## Deployment

The project uses AWS CDK for infrastructure deployment:

```
cd infrastructure
npm run build
cdk deploy
```

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license.

## Questions?

If you have any questions or need help, please open an issue or contact the project maintainers.