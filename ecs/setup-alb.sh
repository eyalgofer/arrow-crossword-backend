#!/bin/bash
set -e

# =============================================================================
# Arrow Crossword Backend - Application Load Balancer Setup
# Run this AFTER setup-networking.sh
# =============================================================================

AWS_REGION="eu-north-1"
PROJECT_NAME="arrow-crossword"

echo "⚖️  Setting up Application Load Balancer..."
echo ""

# =============================================================================
# Step 1: Get VPC and Subnet IDs
# =============================================================================
echo "📦 Step 1: Getting VPC and Subnet info..."

VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region ${AWS_REGION})

# If no default VPC, look for our custom one
if [ "$VPC_ID" == "None" ] || [ "$VPC_ID" == "null" ]; then
  VPC_ID=$(aws ec2 describe-vpcs \
    --filters "Name=tag:Name,Values=${PROJECT_NAME}-vpc" \
    --query "Vpcs[0].VpcId" \
    --output text \
    --region ${AWS_REGION})
fi

echo "   VPC_ID: ${VPC_ID}"

# Get subnets
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=${VPC_ID}" \
  --query "Subnets[*].SubnetId" \
  --output text \
  --region ${AWS_REGION})

SUBNET_ARRAY=($SUBNET_IDS)
SUBNET_1=${SUBNET_ARRAY[0]}
SUBNET_2=${SUBNET_ARRAY[1]:-${SUBNET_ARRAY[0]}}

echo "   SUBNET_1: ${SUBNET_1}"
echo "   SUBNET_2: ${SUBNET_2}"

# Get ALB security group
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${PROJECT_NAME}-alb-sg" "Name=vpc-id,Values=${VPC_ID}" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region ${AWS_REGION})

echo "   ALB_SG_ID: ${ALB_SG_ID}"

# =============================================================================
# Step 2: Create Target Group
# =============================================================================
echo ""
echo "🎯 Step 2: Creating Target Group..."

# Check if target group exists
TG_ARN=$(aws elbv2 describe-target-groups \
  --names "${PROJECT_NAME}-tg" \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$TG_ARN" == "None" ]; then
  TG_ARN=$(aws elbv2 create-target-group \
    --name "${PROJECT_NAME}-tg" \
    --protocol HTTP \
    --port 3000 \
    --vpc-id ${VPC_ID} \
    --target-type ip \
    --health-check-enabled \
    --health-check-path "/health" \
    --health-check-interval-seconds 30 \
    --health-check-timeout-seconds 5 \
    --healthy-threshold-count 2 \
    --unhealthy-threshold-count 3 \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text \
    --region ${AWS_REGION})
  
  echo "   ✅ Created Target Group: ${TG_ARN}"
  
  # Enable stickiness for Socket.io
  echo "   Enabling stickiness for Socket.io..."
  aws elbv2 modify-target-group-attributes \
    --target-group-arn ${TG_ARN} \
    --attributes Key=stickiness.enabled,Value=true Key=stickiness.type,Value=lb_cookie Key=stickiness.lb_cookie.duration_seconds,Value=86400 \
    --region ${AWS_REGION}
else
  echo "   ✅ Target Group already exists: ${TG_ARN}"
fi

# =============================================================================
# Step 3: Create Application Load Balancer
# =============================================================================
echo ""
echo "⚖️  Step 3: Creating Application Load Balancer..."

# Check if ALB exists
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "${PROJECT_NAME}-alb" \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$ALB_ARN" == "None" ]; then
  ALB_ARN=$(aws elbv2 create-load-balancer \
    --name "${PROJECT_NAME}-alb" \
    --subnets ${SUBNET_1} ${SUBNET_2} \
    --security-groups ${ALB_SG_ID} \
    --scheme internet-facing \
    --type application \
    --ip-address-type ipv4 \
    --query "LoadBalancers[0].LoadBalancerArn" \
    --output text \
    --region ${AWS_REGION})
  
  echo "   ✅ Created ALB: ${ALB_ARN}"
  echo "   ⏳ Waiting for ALB to become active..."
  
  aws elbv2 wait load-balancer-available \
    --load-balancer-arns ${ALB_ARN} \
    --region ${AWS_REGION}
  
  echo "   ✅ ALB is now active"
else
  echo "   ✅ ALB already exists: ${ALB_ARN}"
fi

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns ${ALB_ARN} \
  --query "LoadBalancers[0].DNSName" \
  --output text \
  --region ${AWS_REGION})

echo "   ALB DNS: ${ALB_DNS}"

# =============================================================================
# Step 4: Create Listener
# =============================================================================
echo ""
echo "👂 Step 4: Creating HTTP Listener..."

# Check if listener exists
LISTENER_ARN=$(aws elbv2 describe-listeners \
  --load-balancer-arn ${ALB_ARN} \
  --query "Listeners[?Port==\`80\`].ListenerArn" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "")

if [ -z "$LISTENER_ARN" ]; then
  LISTENER_ARN=$(aws elbv2 create-listener \
    --load-balancer-arn ${ALB_ARN} \
    --protocol HTTP \
    --port 80 \
    --default-actions Type=forward,TargetGroupArn=${TG_ARN} \
    --query "Listeners[0].ListenerArn" \
    --output text \
    --region ${AWS_REGION})
  
  echo "   ✅ Created HTTP Listener: ${LISTENER_ARN}"
else
  echo "   ✅ HTTP Listener already exists: ${LISTENER_ARN}"
fi

# =============================================================================
# Get ECS Security Group
# =============================================================================
ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${PROJECT_NAME}-ecs-sg" "Name=vpc-id,Values=${VPC_ID}" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region ${AWS_REGION})

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================================="
echo "✅ ALB SETUP COMPLETE!"
echo "============================================================================="
echo ""
echo "📋 Your resource IDs (SAVE THESE!):"
echo ""
echo "   ALB_ARN=${ALB_ARN}"
echo "   ALB_DNS=${ALB_DNS}"
echo "   TG_ARN=${TG_ARN}"
echo ""
echo "🌐 Your API will be available at:"
echo "   http://${ALB_DNS}"
echo ""
echo "============================================================================="
echo ""
echo "📋 Final Step - Create ECS Service:"
echo ""
echo "   Copy and run this command:"
echo ""
echo "   aws ecs create-service \\"
echo "     --cluster arrow-crossword-cluster \\"
echo "     --service-name arrow-crossword-service \\"
echo "     --task-definition arrow-crossword-backend \\"
echo "     --desired-count 1 \\"
echo "     --launch-type FARGATE \\"
echo "     --network-configuration 'awsvpcConfiguration={subnets=[${SUBNET_1},${SUBNET_2}],securityGroups=[${ECS_SG_ID}],assignPublicIp=ENABLED}' \\"
echo "     --load-balancers 'targetGroupArn=${TG_ARN},containerName=arrow-crossword-backend,containerPort=3000' \\"
echo "     --region ${AWS_REGION}"
echo ""

