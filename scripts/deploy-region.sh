#!/bin/bash

# Usage: ./deploy-region.sh <region> <node_env>

REGION=${1:-us-central1}  # Default to 'us-central1' if no region is provided

gcloud run deploy $SERVICE_NAME-$REGION \
    --image=gcr.io/$PROJECT_ID/$SERVICE_NAME:$GITHUB_SHA \
    --cpu=1 \
    --min-instances=1 \
    --concurrency=100 \
    --memory=2Gi \
    --timeout=300 \
    --port=3000 \
    --platform=managed \
    --region=$REGION \
    --allow-unauthenticated
