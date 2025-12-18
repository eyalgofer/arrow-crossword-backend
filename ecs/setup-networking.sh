#!/bin/bash
set -e

# =============================================================================
# Arrow Crossword Backend - VPC & Security Groups Setup
# =============================================================================

AWS_REGION="eu-north-1"
PROJECT_NAME="arrow-crossword"

echo "🌐 Setting up VPC and Security Groups..."
echo "   Region: ${AWS_REGION}"
echo ""

# =============================================================================
# Step 1: Get or Create VPC
# =============================================================================
echo "📦 Step 1: Checking for existing VPC..."

# Try to get the default VPC first
DEFAULT_VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=isDefault,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$DEFAULT_VPC_ID" != "None" ] && [ "$DEFAULT_VPC_ID" != "null" ]; then
  VPC_ID=$DEFAULT_VPC_ID
  echo "   ✅ Using default VPC: ${VPC_ID}"
else
  echo "   ⚠️  No default VPC found. Creating a new VPC..."
  VPC_ID=$(aws ec2 create-vpc \
    --cidr-block 10.0.0.0/16 \
    --query "Vpc.VpcId" \
    --output text \
    --region ${AWS_REGION})
  
  # Enable DNS hostnames
  aws ec2 modify-vpc-attribute \
    --vpc-id ${VPC_ID} \
    --enable-dns-hostnames \
    --region ${AWS_REGION}
  
  # Tag the VPC
  aws ec2 create-tags \
    --resources ${VPC_ID} \
    --tags Key=Name,Value=${PROJECT_NAME}-vpc \
    --region ${AWS_REGION}
  
  echo "   ✅ Created VPC: ${VPC_ID}"
fi

echo ""
echo "   VPC_ID=${VPC_ID}"

# =============================================================================
# Step 2: Get Subnets
# =============================================================================
echo ""
echo "📦 Step 2: Getting subnets..."

# Get all subnets in the VPC
SUBNET_IDS=$(aws ec2 describe-subnets \
  --filters "Name=vpc-id,Values=${VPC_ID}" \
  --query "Subnets[*].SubnetId" \
  --output text \
  --region ${AWS_REGION})

if [ -z "$SUBNET_IDS" ]; then
  echo "   ⚠️  No subnets found. Creating subnets..."
  
  # Get availability zones
  AZS=$(aws ec2 describe-availability-zones \
    --query "AvailabilityZones[0:2].ZoneName" \
    --output text \
    --region ${AWS_REGION})
  
  AZ_ARRAY=($AZS)
  
  # Create subnet 1
  SUBNET_1=$(aws ec2 create-subnet \
    --vpc-id ${VPC_ID} \
    --cidr-block 10.0.1.0/24 \
    --availability-zone ${AZ_ARRAY[0]} \
    --query "Subnet.SubnetId" \
    --output text \
    --region ${AWS_REGION})
  
  # Create subnet 2
  SUBNET_2=$(aws ec2 create-subnet \
    --vpc-id ${VPC_ID} \
    --cidr-block 10.0.2.0/24 \
    --availability-zone ${AZ_ARRAY[1]} \
    --query "Subnet.SubnetId" \
    --output text \
    --region ${AWS_REGION})
  
  # Enable auto-assign public IP
  aws ec2 modify-subnet-attribute --subnet-id ${SUBNET_1} --map-public-ip-on-launch --region ${AWS_REGION}
  aws ec2 modify-subnet-attribute --subnet-id ${SUBNET_2} --map-public-ip-on-launch --region ${AWS_REGION}
  
  SUBNET_IDS="${SUBNET_1} ${SUBNET_2}"
  echo "   ✅ Created subnets: ${SUBNET_IDS}"
else
  echo "   ✅ Found existing subnets: ${SUBNET_IDS}"
fi

# Convert to array and get first two
SUBNET_ARRAY=($SUBNET_IDS)
SUBNET_1=${SUBNET_ARRAY[0]}
SUBNET_2=${SUBNET_ARRAY[1]:-${SUBNET_ARRAY[0]}}

echo "   SUBNET_1=${SUBNET_1}"
echo "   SUBNET_2=${SUBNET_2}"

# =============================================================================
# Step 3: Create Internet Gateway (if needed for new VPC)
# =============================================================================
echo ""
echo "📦 Step 3: Checking Internet Gateway..."

IGW_ID=$(aws ec2 describe-internet-gateways \
  --filters "Name=attachment.vpc-id,Values=${VPC_ID}" \
  --query "InternetGateways[0].InternetGatewayId" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$IGW_ID" == "None" ] || [ "$IGW_ID" == "null" ]; then
  echo "   Creating Internet Gateway..."
  IGW_ID=$(aws ec2 create-internet-gateway \
    --query "InternetGateway.InternetGatewayId" \
    --output text \
    --region ${AWS_REGION})
  
  aws ec2 attach-internet-gateway \
    --internet-gateway-id ${IGW_ID} \
    --vpc-id ${VPC_ID} \
    --region ${AWS_REGION}
  
  echo "   ✅ Created and attached Internet Gateway: ${IGW_ID}"
else
  echo "   ✅ Internet Gateway exists: ${IGW_ID}"
fi

# =============================================================================
# Step 4: Create Security Group for ALB (Load Balancer)
# =============================================================================
echo ""
echo "🔒 Step 4: Creating ALB Security Group..."

# Check if ALB security group already exists
ALB_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${PROJECT_NAME}-alb-sg" "Name=vpc-id,Values=${VPC_ID}" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$ALB_SG_ID" == "None" ] || [ "$ALB_SG_ID" == "null" ]; then
  ALB_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-alb-sg" \
    --description "Security group for Arrow Crossword ALB" \
    --vpc-id ${VPC_ID} \
    --query "GroupId" \
    --output text \
    --region ${AWS_REGION})
  
  echo "   ✅ Created ALB Security Group: ${ALB_SG_ID}"
  
  # Allow HTTP (port 80) from anywhere
  echo "   Adding rule: Allow HTTP (80) from anywhere..."
  aws ec2 authorize-security-group-ingress \
    --group-id ${ALB_SG_ID} \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region ${AWS_REGION}
  
  # Allow HTTPS (port 443) from anywhere
  echo "   Adding rule: Allow HTTPS (443) from anywhere..."
  aws ec2 authorize-security-group-ingress \
    --group-id ${ALB_SG_ID} \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region ${AWS_REGION}
else
  echo "   ✅ ALB Security Group already exists: ${ALB_SG_ID}"
fi

echo "   ALB_SG_ID=${ALB_SG_ID}"

# =============================================================================
# Step 5: Create Security Group for ECS Tasks
# =============================================================================
echo ""
echo "🔒 Step 5: Creating ECS Security Group..."

# Check if ECS security group already exists
ECS_SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=${PROJECT_NAME}-ecs-sg" "Name=vpc-id,Values=${VPC_ID}" \
  --query "SecurityGroups[0].GroupId" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null || echo "None")

if [ "$ECS_SG_ID" == "None" ] || [ "$ECS_SG_ID" == "null" ]; then
  ECS_SG_ID=$(aws ec2 create-security-group \
    --group-name "${PROJECT_NAME}-ecs-sg" \
    --description "Security group for Arrow Crossword ECS tasks" \
    --vpc-id ${VPC_ID} \
    --query "GroupId" \
    --output text \
    --region ${AWS_REGION})
  
  echo "   ✅ Created ECS Security Group: ${ECS_SG_ID}"
  
  # Allow traffic from ALB on port 3000
  echo "   Adding rule: Allow port 3000 from ALB security group..."
  aws ec2 authorize-security-group-ingress \
    --group-id ${ECS_SG_ID} \
    --protocol tcp \
    --port 3000 \
    --source-group ${ALB_SG_ID} \
    --region ${AWS_REGION}
else
  echo "   ✅ ECS Security Group already exists: ${ECS_SG_ID}"
fi

echo "   ECS_SG_ID=${ECS_SG_ID}"

# =============================================================================
# Summary
# =============================================================================
echo ""
echo "============================================================================="
echo "✅ NETWORKING SETUP COMPLETE!"
echo "============================================================================="
echo ""
echo "📋 Your resource IDs (SAVE THESE!):"
echo ""
echo "   VPC_ID=${VPC_ID}"
echo "   SUBNET_1=${SUBNET_1}"
echo "   SUBNET_2=${SUBNET_2}"
echo "   ALB_SG_ID=${ALB_SG_ID}"
echo "   ECS_SG_ID=${ECS_SG_ID}"
echo ""
echo "============================================================================="
echo ""
echo "🔐 Security Group Rules Created:"
echo ""
echo "   ${PROJECT_NAME}-alb-sg (${ALB_SG_ID}):"
echo "   ┌─────────────┬──────────┬─────────────────┐"
echo "   │ Type        │ Port     │ Source          │"
echo "   ├─────────────┼──────────┼─────────────────┤"
echo "   │ HTTP        │ 80       │ 0.0.0.0/0       │"
echo "   │ HTTPS       │ 443      │ 0.0.0.0/0       │"
echo "   └─────────────┴──────────┴─────────────────┘"
echo ""
echo "   ${PROJECT_NAME}-ecs-sg (${ECS_SG_ID}):"
echo "   ┌─────────────┬──────────┬─────────────────┐"
echo "   │ Type        │ Port     │ Source          │"
echo "   ├─────────────┼──────────┼─────────────────┤"
echo "   │ Custom TCP  │ 3000     │ ALB SG          │"
echo "   └─────────────┴──────────┴─────────────────┘"
echo ""
echo "============================================================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "   1. Create the Application Load Balancer:"
echo "      ./ecs/setup-alb.sh"
echo ""
echo "   2. Or manually copy these values for creating the ECS service:"
echo ""
echo "      aws ecs create-service \\"
echo "        --cluster arrow-crossword-cluster \\"
echo "        --service-name arrow-crossword-service \\"
echo "        --task-definition arrow-crossword-backend \\"
echo "        --desired-count 1 \\"
echo "        --launch-type FARGATE \\"
echo "        --network-configuration \"awsvpcConfiguration={subnets=[${SUBNET_1},${SUBNET_2}],securityGroups=[${ECS_SG_ID}],assignPublicIp=ENABLED}\" \\"
echo "        --region ${AWS_REGION}"
echo ""

