#!/bin/bash
set -e

# =============================================================================
# Arrow Crossword Backend - AWS Infrastructure Setup
# Run this ONCE to set up all required AWS resources
# =============================================================================

# Configuration - UPDATE THESE VALUES
AWS_REGION="eu-north-1"
AWS_ACCOUNT_ID="211888002768"  # Replace with your AWS account ID
ECR_REPOSITORY="arrow-crossword-backend"
ECS_CLUSTER="arrow-crossword-cluster"

echo "🏗️  Setting up AWS infrastructure for Arrow Crossword Backend..."
echo "   Region: ${AWS_REGION}"
echo ""

# =============================================================================
# Step 1: Create ECR Repository
# =============================================================================
echo "📦 Step 1: Creating ECR repository..."
aws ecr create-repository \
  --repository-name ${ECR_REPOSITORY} \
  --region ${AWS_REGION} \
  --image-scanning-configuration scanOnPush=true \
  2>/dev/null || echo "   Repository already exists, skipping..."

# =============================================================================
# Step 2: Create CloudWatch Log Group
# =============================================================================
echo ""
echo "📊 Step 2: Creating CloudWatch log group..."
aws logs create-log-group \
  --log-group-name /ecs/${ECR_REPOSITORY} \
  --region ${AWS_REGION} \
  2>/dev/null || echo "   Log group already exists, skipping..."

# =============================================================================
# Step 3: Create ECS Cluster
# =============================================================================
echo ""
echo "🎯 Step 3: Creating ECS cluster..."
aws ecs create-cluster \
  --cluster-name ${ECS_CLUSTER} \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --region ${AWS_REGION} \
  2>/dev/null || echo "   Cluster already exists, skipping..."

# =============================================================================
# Step 4: Create IAM Roles (if they don't exist)
# =============================================================================
echo ""
echo "🔐 Step 4: Setting up IAM roles..."

# Create trust policy for ECS tasks
cat > /tmp/ecs-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create ecsTaskExecutionRole
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json \
  2>/dev/null || echo "   ecsTaskExecutionRole already exists..."

aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy \
  2>/dev/null || true

# Add Secrets Manager access to execution role
cat > /tmp/secrets-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:arrow-crossword/*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-name SecretsManagerAccess \
  --policy-document file:///tmp/secrets-policy.json \
  2>/dev/null || true

# Create ecsTaskRole (for application permissions)
aws iam create-role \
  --role-name ecsTaskRole \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json \
  2>/dev/null || echo "   ecsTaskRole already exists..."

rm /tmp/ecs-trust-policy.json /tmp/secrets-policy.json

echo ""
echo "✅ AWS infrastructure setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Create your secrets in AWS Secrets Manager:"
echo "      aws secretsmanager create-secret --name arrow-crossword/mongodb-uri --secret-string 'your-mongodb-uri' --region ${AWS_REGION}"
echo "      aws secretsmanager create-secret --name arrow-crossword/jwt-secret --secret-string 'your-jwt-secret' --region ${AWS_REGION}"
echo "      aws secretsmanager create-secret --name arrow-crossword/google-client-id --secret-string 'your-google-client-id' --region ${AWS_REGION}"
echo ""
echo "   2. Update ecs/task-definition.json with your AWS_ACCOUNT_ID and AWS_REGION"
echo ""
echo "   3. Create VPC, subnets, security groups, and ALB via AWS Console or CLI"
echo ""
echo "   4. Register the task definition:"
echo "      aws ecs register-task-definition --cli-input-json file://ecs/task-definition.json --region ${AWS_REGION}"
echo ""
echo "   5. Create the ECS service with your ALB target group"

