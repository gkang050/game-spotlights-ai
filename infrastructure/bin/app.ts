#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GameSpotlightsStack } from '../lib/game-spotlights-stack';
import { GameHighlightsPocStack } from '../lib/poc-stack';

const app = new cdk.App();

// Deploy PoC stack for demo
new GameHighlightsPocStack(app, 'GameHighlightsPocStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
  },
  description: 'Game Highlights PoC - Demo for AWS Summit LA',
});

// Full production stack (commented out for PoC)
// new GameSpotlightsStack(app, 'GameSpotlightsStack', {
//   env: { 
//     account: process.env.CDK_DEFAULT_ACCOUNT, 
//     region: process.env.CDK_DEFAULT_REGION || 'us-east-1' 
//   },
//   description: 'Game Spotlights AI - Real-time personalized game highlights using AWS AI/ML services',
// });

app.synth();