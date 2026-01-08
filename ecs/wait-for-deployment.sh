#!/bin/bash
# =============================================================================
# Wait for ECS Deployment and Show Logs
# =============================================================================

AWS_REGION="eu-north-1"
ECS_CLUSTER="arrow-crossword-cluster"
ECS_SERVICE="arrow-crossword-service"
TASK_DEFINITION="arrow-crossword-backend:5"

echo "⏳ Waiting for new deployment (task definition: ${TASK_DEFINITION})..."
echo ""

MAX_WAIT=300  # 5 minutes
ELAPSED=0
INTERVAL=10

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Get the new task
  NEW_TASK=$(aws ecs list-tasks \
    --cluster ${ECS_CLUSTER} \
    --service-name ${ECS_SERVICE} \
    --region ${AWS_REGION} \
    --query "taskArns[?contains(@, '${TASK_DEFINITION}')]" \
    --output text 2>/dev/null | head -1)
  
  if [ -z "$NEW_TASK" ] || [ "$NEW_TASK" == "None" ]; then
    echo "   Still waiting for new task to start... (${ELAPSED}s)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
    continue
  fi
  
  # Check task status
  STATUS=$(aws ecs describe-tasks \
    --cluster ${ECS_CLUSTER} \
    --tasks ${NEW_TASK} \
    --region ${AWS_REGION} \
    --query 'tasks[0].lastStatus' \
    --output text 2>/dev/null)
  
  HEALTH=$(aws ecs describe-tasks \
    --cluster ${ECS_CLUSTER} \
    --tasks ${NEW_TASK} \
    --region ${AWS_REGION} \
    --query 'tasks[0].healthStatus' \
    --output text 2>/dev/null)
  
  echo "   Task: ${NEW_TASK}"
  echo "   Status: ${STATUS}"
  echo "   Health: ${HEALTH}"
  
  if [ "$STATUS" == "RUNNING" ] && [ "$HEALTH" == "HEALTHY" ]; then
    echo ""
    echo "✅ New deployment is running and healthy!"
    echo ""
    echo "📝 Showing logs from new task..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Extract task ID from ARN
    TASK_ID=$(echo $NEW_TASK | awk -F'/' '{print $NF}')
    
    # Show logs
    aws logs tail /ecs/arrow-crossword-backend \
      --region ${AWS_REGION} \
      --since 5m \
      --format short \
      --filter-pattern "${TASK_ID}" 2>/dev/null || \
    aws logs tail /ecs/arrow-crossword-backend \
      --region ${AWS_REGION} \
      --since 5m \
      --format short
    
    echo ""
    echo "💡 To follow logs in real-time:"
    echo "   aws logs tail /ecs/arrow-crossword-backend --region ${AWS_REGION} --follow"
    exit 0
  elif [ "$STATUS" == "STOPPED" ]; then
    echo ""
    echo "❌ Task stopped. Checking reason..."
    REASON=$(aws ecs describe-tasks \
      --cluster ${ECS_CLUSTER} \
      --tasks ${NEW_TASK} \
      --region ${AWS_REGION} \
      --query 'tasks[0].containers[0].reason' \
      --output text 2>/dev/null)
    echo "   Reason: ${REASON}"
    exit 1
  else
    echo "   Still starting... (${ELAPSED}s)"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
  fi
done

echo ""
echo "⏰ Timeout waiting for deployment. Checking status..."
./ecs/check-deployment.sh
