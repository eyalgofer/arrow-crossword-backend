# Apple Sign In Setup Guide

This guide will help you configure Apple Sign In for your backend.

## Step 1: Find Your Apple Bundle ID

You need to find your iOS app's Bundle ID. This is the identifier Apple uses to verify tokens.

### Option A: From Xcode
1. Open your iOS project in Xcode
2. Select your project in the navigator
3. Select your app target
4. Go to the **General** tab
5. Look for **Bundle Identifier** (e.g., `com.yourcompany.arrowcrossword`)

### Option B: From Apple Developer Portal
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers**
4. Find your App ID
5. The Bundle ID is listed there (e.g., `com.yourcompany.arrowcrossword`)

### Option C: From Your Frontend Code
If you're using Expo or React Native, check:
- `app.json` or `app.config.js` for `ios.bundleIdentifier`
- Or your `Info.plist` file

**Example Bundle ID:** `com.yourcompany.arrowcrossword`

---

## Step 2: Configure Local Development (.env file)

Create or update your `.env` file in the project root:

```bash
# Apple Sign In Configuration
# Use your iOS app's Bundle ID (at least one is required)
APPLE_BUNDLE_ID=com.yourcompany.arrowcrossword

# Alternative names (optional, but recommended for flexibility)
APPLE_CLIENT_ID=com.yourcompany.arrowcrossword
APPLE_SERVICE_ID=com.yourcompany.arrowcrossword.service

# JWT Secret (should already exist)
JWT_SECRET=your-existing-jwt-secret
```

**Note:** You only need **one** of these (APPLE_BUNDLE_ID, APPLE_CLIENT_ID, or APPLE_SERVICE_ID), but having multiple won't hurt. The code will check all of them.

---

## Step 3: Configure Production (AWS Secrets Manager)

Since you're using AWS ECS with Secrets Manager, you need to add the Apple configuration there.

### Option A: Using AWS Console

1. Go to [AWS Secrets Manager Console](https://console.aws.amazon.com/secretsmanager/)
2. Find or create a secret for your Apple configuration
3. Add the following key-value pairs:
   ```
   APPLE_BUNDLE_ID=com.yourcompany.arrowcrossword
   APPLE_CLIENT_ID=com.yourcompany.arrowcrossword
   ```

### Option B: Using AWS CLI

```bash
# Create a new secret (if you want a separate one)
aws secretsmanager create-secret \
  --name arrow-crossword/apple-config \
  --secret-string '{"APPLE_BUNDLE_ID":"com.yourcompany.arrowcrossword","APPLE_CLIENT_ID":"com.yourcompany.arrowcrossword"}' \
  --region eu-north-1

# Or add to existing secret
aws secretsmanager update-secret \
  --secret-id arrow-crossword/apple-config \
  --secret-string '{"APPLE_BUNDLE_ID":"com.yourcompany.arrowcrossword","APPLE_CLIENT_ID":"com.yourcompany.arrowcrossword"}' \
  --region eu-north-1
```

### Update ECS Task Definition

Update `ecs/task-definition.json` to include the Apple secrets:

```json
"secrets": [
  {
    "name": "MONGODB_URI",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/mongodb-uri-Ce1eFr"
  },
  {
    "name": "JWT_SECRET",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/jwt-secret-j3xGL3"
  },
  {
    "name": "GOOGLE_CLIENT_ID",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/google-client-id-N5IfkE"
  },
  {
    "name": "APPLE_BUNDLE_ID",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/apple-config:APPLE_BUNDLE_ID::"
  },
  {
    "name": "APPLE_CLIENT_ID",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/apple-config:APPLE_CLIENT_ID::"
  }
]
```

**Note:** Replace the ARN with your actual secret ARN.

---

## Step 4: Verify Your Configuration

### Test Locally

1. Make sure your `.env` file is set up
2. Start your server:
   ```bash
   npm run dev
   ```
3. Check the logs - there should be no errors about missing Apple config

### Test the Endpoint

You can test with a real Apple identity token from your iOS app:

```bash
curl -X POST http://localhost:3000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{
    "identityToken": "YOUR_APPLE_IDENTITY_TOKEN",
    "name": "Test User"
  }'
```

### Common Issues

**Error: "Invalid audience"**
- Your Bundle ID doesn't match what's in the token
- Solution: Double-check your Bundle ID matches exactly (case-sensitive)

**Error: "Token verification failed"**
- The token might be expired or invalid
- Solution: Make sure you're using a fresh token from Apple Sign In

**Error: "No Apple Client ID configured"**
- Environment variable is missing
- Solution: Make sure at least one of APPLE_BUNDLE_ID, APPLE_CLIENT_ID, or APPLE_SERVICE_ID is set

---

## Step 5: Frontend Integration

Make sure your frontend is sending the correct data:

```typescript
// Example frontend code
const response = await fetch('https://your-api.com/api/auth/apple', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    identityToken: appleIdentityToken, // From Apple Sign In
    name: appleUserFullName?.givenName + ' ' + appleUserFullName?.familyName, // Optional, only on first sign-in
  }),
});
```

---

## Quick Checklist

- [ ] Found your Bundle ID from Xcode/Apple Developer Portal
- [ ] Added APPLE_BUNDLE_ID to local `.env` file
- [ ] Created/updated AWS Secrets Manager secret
- [ ] Updated ECS task definition with Apple secrets
- [ ] Tested locally with `npm run dev`
- [ ] Verified endpoint responds correctly

---

## Need Help?

If you encounter issues:

1. **Check the logs** - The backend will log detailed error messages
2. **Verify Bundle ID** - Make sure it matches exactly (case-sensitive)
3. **Check token format** - Ensure the identityToken is a valid JWT
4. **Test with a fresh token** - Tokens expire, get a new one from Apple Sign In

The error messages in the API response will guide you to the specific issue!
