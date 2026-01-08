#!/bin/bash
set -e

# =============================================================================
# Arrow Crossword Backend - ECS Fargate Deployment Script
# =============================================================================

# Configuration - UPDATE THESE VALUES
AWS_REGION="eu-north-1"
AWS_ACCOUNT_ID="211888002768"  # Replace with your AWS account ID
ECR_REPOSITORY="arrow-crossword-backend"
ECS_CLUSTER="arrow-crossword-cluster"
ECS_SERVICE="arrow-crossword-service"
IMAGE_TAG="${1:-latest}"

# Derived values
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"

echo "🚀 Starting deployment..."
echo "   Region: ${AWS_REGION}"
echo "   Repository: ${ECR_URI}"
echo "   Tag: ${IMAGE_TAG}"

# Step 1: Login to ECR
echo ""
echo "📦 Step 1: Logging into ECR..."
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Step 2: Build Docker image
echo ""
echo "🔨 Step 2: Building Docker image for linux/amd64 (ECS Fargate requires this)..."
# Get the directory where this script is located, then go to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"
docker build --platform linux/amd64 -t ${ECR_REPOSITORY}:${IMAGE_TAG} .

# Step 3: Tag image for ECR
echo ""
echo "🏷️  Step 3: Tagging image..."
docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} ${ECR_URI}:${IMAGE_TAG}

# Step 4: Push to ECR
echo ""
echo "⬆️  Step 4: Pushing image to ECR..."
docker push ${ECR_URI}:${IMAGE_TAG}

# Step 5: Update ECS service (force new deployment)
echo ""
echo "🔄 Step 5: Updating ECS service..."
echo "   This may take a moment..."
UPDATE_RESULT=$(aws ecs update-service \
  --cluster ${ECS_CLUSTER} \
  --service ${ECS_SERVICE} \
  --force-new-deployment \
  --region ${AWS_REGION} \
  --no-cli-pager \
  --output json 2>&1)

if [ $? -eq 0 ]; then
  echo "   ✅ Service update initiated successfully"
else
  echo "   ❌ Failed to update service:"
  echo "$UPDATE_RESULT"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment initiated!"
echo ""
echo "📊 Monitor deployment progress:"
echo "   Console: https://${AWS_REGION}.console.aws.amazon.com/ecs/home?region=${AWS_REGION}#/clusters/${ECS_CLUSTER}/services/${ECS_SERVICE}"
echo ""
echo "   Or run: ./ecs/check-deployment.sh"
echo ""
echo "⏳ The new deployment will be ready in 1-3 minutes"
echo "   (ECS needs to pull the image, start the container, and pass health checks)"

