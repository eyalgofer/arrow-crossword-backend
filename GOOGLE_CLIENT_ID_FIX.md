# Fixing Google Client ID Mismatch Error

## The Problem

You're getting this error:
```
Error: Wrong recipient, payload audience != requiredAudience
```

This means the Google Client ID in the token from your client app doesn't match any of the Client IDs configured in your backend.

## How to Fix

### Step 1: Find Out What Client ID Your Token Has

After deploying the updated code, the logs will now show you exactly what Client ID the token contains. Look for:
```
Token audience: <client-id-here>
```

### Step 2: Add All Client IDs to AWS Secrets Manager

You need to store **all** Google Client IDs that your apps use:

1. **Web Client ID** (if you have a web app)
2. **iOS Client ID** (if you have an iOS app)
3. **Android Client ID** (if you have an Android app)

#### Create/Update Secrets:

```bash
# Web Client ID
aws secretsmanager create-secret \
  --name arrow-crossword/google-web-client-id \
  --secret-string "YOUR_WEB_CLIENT_ID_HERE" \
  --region eu-north-1

# iOS Client ID
aws secretsmanager create-secret \
  --name arrow-crossword/google-ios-client-id \
  --secret-string "YOUR_IOS_CLIENT_ID_HERE" \
  --region eu-north-1

# Or update existing secret
aws secretsmanager update-secret \
  --secret-id arrow-crossword/google-client-id-N5IfkE \
  --secret-string "YOUR_CLIENT_ID_HERE" \
  --region eu-north-1
```

### Step 3: Update Task Definition

Add all Client IDs to your `ecs/task-definition.json`:

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
    "name": "GOOGLE_WEB_CLIENT_ID",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/google-web-client-id"
  },
  {
    "name": "GOOGLE_IOS_CLIENT_ID",
    "valueFrom": "arn:aws:secretsmanager:eu-north-1:211888002768:secret:arrow-crossword/google-ios-client-id"
  }
]
```

**Note:** You'll need to get the full ARN for each secret. Run:
```bash
aws secretsmanager describe-secret \
  --secret-id arrow-crossword/google-web-client-id \
  --region eu-north-1 \
  --query 'ARN' \
  --output text
```

### Step 4: Register Updated Task Definition

```bash
aws ecs register-task-definition \
  --cli-input-json file://ecs/task-definition.json \
  --region eu-north-1
```

### Step 5: Force New Deployment

```bash
aws ecs update-service \
  --cluster arrow-crossword-cluster \
  --service arrow-crossword-service \
  --force-new-deployment \
  --region eu-north-1
```

## Quick Diagnostic

After deploying the updated code, check your CloudWatch logs. You should see:
- What Client ID the token contains
- What Client IDs are configured in the backend
- A clear message about the mismatch

## Alternative: Use Single Client ID

If you want to use only one Client ID:

1. Make sure your client app uses the same Client ID as stored in `GOOGLE_CLIENT_ID`
2. Or update the secret to match what your client app is using

## Finding Your Google Client IDs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Go to **APIs & Services** > **Credentials**
4. You'll see all your OAuth 2.0 Client IDs listed there
