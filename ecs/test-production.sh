#!/bin/bash
# =============================================================================
# Test Production Backend Connectivity
# =============================================================================

ALB_DNS="arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com"
BASE_URL="http://${ALB_DNS}"

echo "🧪 Testing Production Backend Connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test 1: Health endpoint
echo "1️⃣  Testing Health Endpoint..."
HEALTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BASE_URL}/health")
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$HEALTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "   ✅ Health check passed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
else
  echo "   ❌ Health check failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

# Test 2: Diagnostic endpoint
echo "2️⃣  Testing Diagnostic Endpoint..."
DIAG_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" "${BASE_URL}/api/diagnostic")
HTTP_CODE=$(echo "$DIAG_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$DIAG_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "200" ]; then
  echo "   ✅ Diagnostic endpoint works (HTTP $HTTP_CODE)"
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "   ❌ Diagnostic endpoint failed (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

# Test 3: Auth endpoint (should fail with 400, but should be reachable)
echo "3️⃣  Testing Auth Endpoint (should return 400 for missing token)..."
AUTH_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{}' \
  "${BASE_URL}/api/auth/google")
HTTP_CODE=$(echo "$AUTH_RESPONSE" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$AUTH_RESPONSE" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" == "400" ]; then
  echo "   ✅ Auth endpoint is reachable (HTTP $HTTP_CODE - expected for missing token)"
  echo "   Response: $BODY"
elif [ "$HTTP_CODE" == "401" ]; then
  echo "   ✅ Auth endpoint is reachable (HTTP $HTTP_CODE)"
else
  echo "   ⚠️  Unexpected response (HTTP $HTTP_CODE)"
  echo "   Response: $BODY"
fi
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Your Production API URL:"
echo "   ${BASE_URL}"
echo ""
echo "💡 Next Steps:"
echo "   1. Update your client app to use this URL"
echo "   2. Test from your client app"
echo "   3. Check CloudWatch logs: aws logs tail /ecs/arrow-crossword-backend --region eu-north-1 --follow"
echo ""
