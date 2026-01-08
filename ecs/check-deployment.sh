#!/bin/bash
# =============================================================================
# Arrow Crossword Backend - Deployment Status Checker
# =============================================================================

AWS_REGION="eu-north-1"
AWS_ACCOUNT_ID="211888002768"
ECS_CLUSTER="arrow-crossword-cluster"
ECS_SERVICE="arrow-crossword-service"
PROJECT_NAME="arrow-crossword"

echo "🔍 Checking deployment status..."
echo ""

# =============================================================================
# Step 1: Check ECS Service Status
# =============================================================================
echo "📊 Step 1: ECS Service Status"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SERVICE_STATUS=$(aws ecs describe-services \
  --cluster ${ECS_CLUSTER} \
  --services ${ECS_SERVICE} \
  --region ${AWS_REGION} \
  --query 'services[0]' \
  --output json 2>/dev/null)

if [ "$SERVICE_STATUS" == "null" ] || [ -z "$SERVICE_STATUS" ]; then
  echo "❌ Service '${ECS_SERVICE}' not found in cluster '${ECS_CLUSTER}'"
  echo "   Run setup-aws.sh and create the service first"
  exit 1
fi

echo "$SERVICE_STATUS" | jq -r '
  "   Service Name: " + .serviceName,
  "   Status: " + .status,
  "   Desired Count: " + (.desiredCount | tostring),
  "   Running Count: " + (.runningCount | tostring),
  "   Pending Count: " + (.pendingCount | tostring),
  "   Deployment Status: " + (.deployments[0].status // "unknown"),
  "   Task Definition: " + (.taskDefinition | split("/") | .[-1])
'
echo ""

# =============================================================================
# Step 2: Check Running Tasks
# =============================================================================
echo "📋 Step 2: Running Tasks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
TASKS=$(aws ecs list-tasks \
  --cluster ${ECS_CLUSTER} \
  --service-name ${ECS_SERVICE} \
  --region ${AWS_REGION} \
  --query 'taskArns' \
  --output json 2>/dev/null)

TASK_COUNT=$(echo "$TASKS" | jq 'length')
echo "   Found $TASK_COUNT task(s)"

if [ "$TASK_COUNT" -gt 0 ]; then
  TASK_ARN=$(echo "$TASKS" | jq -r '.[0]')
  TASK_DETAILS=$(aws ecs describe-tasks \
    --cluster ${ECS_CLUSTER} \
    --tasks ${TASK_ARN} \
    --region ${AWS_REGION} \
    --query 'tasks[0]' \
    --output json 2>/dev/null)
  
  echo "$TASK_DETAILS" | jq -r '
    "   Task ARN: " + .taskArn,
    "   Last Status: " + .lastStatus,
    "   Health Status: " + (.healthStatus // "N/A"),
    "   Started At: " + (.startedAt // "N/A"),
    "   CPU: " + (.cpu // "N/A"),
    "   Memory: " + (.memory // "N/A")
  '
  
  # Get container status
  CONTAINER_STATUS=$(echo "$TASK_DETAILS" | jq -r '.containers[0] | 
    "   Container: " + .name,
    "   Status: " + .lastStatus,
    "   Exit Code: " + (if .exitCode then (.exitCode | tostring) else "N/A" end),
    "   Reason: " + (.reason // "N/A")
  ')
  echo "$CONTAINER_STATUS"
else
  echo "   ⚠️  No tasks running!"
fi
echo ""

# =============================================================================
# Step 3: Get ALB DNS Name
# =============================================================================
echo "🌐 Step 3: Load Balancer Information"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "${PROJECT_NAME}-alb" \
  --query "LoadBalancers[0].LoadBalancerArn" \
  --output text \
  --region ${AWS_REGION} 2>/dev/null)

if [ "$ALB_ARN" != "None" ] && [ -n "$ALB_ARN" ]; then
  ALB_INFO=$(aws elbv2 describe-load-balancers \
    --load-balancer-arns ${ALB_ARN} \
    --region ${AWS_REGION} \
    --query "LoadBalancers[0]" \
    --output json 2>/dev/null)
  
  ALB_DNS=$(echo "$ALB_INFO" | jq -r '.DNSName')
  ALB_STATE=$(echo "$ALB_INFO" | jq -r '.State.Code')
  
  echo "   ALB DNS: ${ALB_DNS}"
  echo "   ALB State: ${ALB_STATE}"
  echo ""
  
  # Check target group health
  TG_ARN=$(aws elbv2 describe-target-groups \
    --names "${PROJECT_NAME}-tg" \
    --query "TargetGroups[0].TargetGroupArn" \
    --output text \
    --region ${AWS_REGION} 2>/dev/null)
  
  if [ "$TG_ARN" != "None" ] && [ -n "$TG_ARN" ]; then
    echo "   Target Group Health:"
    HEALTH=$(aws elbv2 describe-target-health \
      --target-group-arn ${TG_ARN} \
      --region ${AWS_REGION} \
      --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
      --output table 2>/dev/null)
    echo "$HEALTH"
  fi
else
  echo "   ⚠️  ALB not found. Run setup-alb.sh first"
fi
echo ""

# =============================================================================
# Step 4: Test Health Endpoint
# =============================================================================
if [ -n "$ALB_DNS" ]; then
  echo "🏥 Step 4: Testing Health Endpoint"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  HEALTH_URL="http://${ALB_DNS}/health"
  echo "   Testing: ${HEALTH_URL}"
  
  HTTP_CODE=$(curl -s -o /tmp/health_response.json -w "%{http_code}" --max-time 5 "${HEALTH_URL}" 2>/dev/null || echo "000")
  
  if [ "$HTTP_CODE" == "200" ]; then
    echo "   ✅ Health check passed (HTTP $HTTP_CODE)"
    cat /tmp/health_response.json | jq '.' 2>/dev/null || cat /tmp/health_response.json
  elif [ "$HTTP_CODE" == "000" ]; then
    echo "   ❌ Connection failed - service may not be accessible"
  else
    echo "   ⚠️  Health check returned HTTP $HTTP_CODE"
    cat /tmp/health_response.json 2>/dev/null
  fi
  rm -f /tmp/health_response.json
  echo ""
fi

# =============================================================================
# Step 5: Recent Logs
# =============================================================================
echo "📝 Step 5: Recent Logs (last 20 lines)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
LOG_GROUP="/ecs/${ECS_SERVICE}"
aws logs tail ${LOG_GROUP} \
  --region ${AWS_REGION} \
  --since 5m \
  --format short \
  --follow false 2>/dev/null | tail -20 || echo "   ⚠️  Could not fetch logs (log group may not exist yet)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Status check complete!"
echo ""
echo "💡 Quick Links:"
echo ""
echo "   📊 ECS Service Console:"
echo "      https://${AWS_REGION}.console.aws.amazon.com/ecs/home?region=${AWS_REGION}#/clusters/${ECS_CLUSTER}/services/${ECS_SERVICE}"
echo ""
echo "   📝 CloudWatch Logs (Direct):"
echo "      https://${AWS_REGION}.console.aws.amazon.com/cloudwatch/home?region=${AWS_REGION}#logsV2:log-groups/log-group/%2Fecs%2Farrow-crossword-backend"
echo ""
echo "   📋 ECS Service Logs Tab:"
echo "      https://${AWS_REGION}.console.aws.amazon.com/ecs/v2/clusters/${ECS_CLUSTER}/services/${ECS_SERVICE}/logs?region=${AWS_REGION}"
echo ""
echo "💡 Command Line:"
echo "   - View full logs: aws logs tail ${LOG_GROUP} --region ${AWS_REGION} --follow"
if [ -n "$ALB_DNS" ]; then
  echo "   - Test API: curl http://${ALB_DNS}/health"
fi
