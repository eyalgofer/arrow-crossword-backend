#!/bin/bash
# =============================================================================
# Google OAuth Configuration Checker
# =============================================================================

AWS_REGION="eu-north-1"
SECRET_NAME="arrow-crossword/google-client-id"

echo "🔍 Checking Google OAuth Configuration..."
echo ""

# Get the current secret value
echo "📋 Current Google Client ID in AWS Secrets Manager:"
SECRET_ARN=$(aws secretsmanager list-secrets \
  --region ${AWS_REGION} \
  --query "SecretList[?Name=='${SECRET_NAME}'].ARN" \
  --output text)

if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" == "None" ]; then
  echo "   ❌ Secret not found: ${SECRET_NAME}"
  echo ""
  echo "   💡 Create it with:"
  echo "      aws secretsmanager create-secret \\"
  echo "        --name ${SECRET_NAME} \\"
  echo "        --secret-string 'YOUR_GOOGLE_CLIENT_ID' \\"
  echo "        --region ${AWS_REGION}"
  exit 1
fi

CURRENT_CLIENT_ID=$(aws secretsmanager get-secret-value \
  --secret-id ${SECRET_ARN} \
  --region ${AWS_REGION} \
  --query 'SecretString' \
  --output text)

echo "   ✅ Found: ${CURRENT_CLIENT_ID}"
echo ""

# Check task definition
echo "📋 Task Definition Configuration:"
TASK_DEF=$(aws ecs describe-task-definition \
  --task-definition arrow-crossword-backend \
  --region ${AWS_REGION} \
  --query 'taskDefinition.containerDefinitions[0].secrets' \
  --output json 2>/dev/null)

if [ -n "$TASK_DEF" ] && [ "$TASK_DEF" != "null" ]; then
  echo "$TASK_DEF" | jq -r '.[] | select(.name | contains("GOOGLE")) | "   \(.name): \(.valueFrom // "not set")"'
else
  echo "   ⚠️  Could not read task definition"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 Next Steps:"
echo ""
echo "1. After deploying the updated code, check CloudWatch logs when signing in"
echo "2. Look for: 'Token audience: <client-id>' in the logs"
echo "3. If it doesn't match the Client ID above, you need to:"
echo ""
echo "   Option A: Add the token's Client ID to AWS Secrets Manager"
echo "   Option B: Update your client app to use: ${CURRENT_CLIENT_ID}"
echo ""
echo "📝 To add additional Client IDs (Web/iOS), update task-definition.json"
echo "   and add them as GOOGLE_WEB_CLIENT_ID and GOOGLE_IOS_CLIENT_ID"
echo ""
