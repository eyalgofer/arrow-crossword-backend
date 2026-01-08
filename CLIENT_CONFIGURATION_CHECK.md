# Client Configuration Check - Production Not Receiving Requests

## Problem
Your production backend is running and healthy, but **no requests are reaching it**. This means your client app is likely pointing to the wrong URL.

## Your Production API URL

```
http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com
```

## Quick Test

### 1. Test from Browser/Postman
Open this URL in your browser:
```
http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com/api/diagnostic
```

You should see a JSON response. If you do, the backend is reachable.

### 2. Test Health Endpoint
```
http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com/health
```

### 3. Check Your Client App Configuration

**Look for these in your client code:**
- API base URL configuration
- Environment variables for API endpoints
- `.env` files
- Configuration files

**Common places to check:**
- `app/config/api.ts` or similar
- `app/services/auth.ts` (where the error occurs)
- Environment variables: `API_URL`, `BASE_URL`, `BACKEND_URL`
- `.env`, `.env.production`, `.env.development` files

**What to look for:**
```typescript
// ❌ WRONG - Still pointing to localhost or dev
const API_URL = 'http://localhost:3000';
const API_URL = 'http://192.168.1.100:3000'; // Local network IP
const API_URL = process.env.API_URL || 'http://localhost:3000';

// ✅ CORRECT - Should point to production
const API_URL = 'http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com';
// Or use environment variable:
const API_URL = process.env.API_URL || 'http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com';
```

## How to Verify Your Client is Using Production

### Option 1: Add Logging to Your Client

In your client's auth service (where the error occurs), add:

```typescript
console.log('🌐 API URL:', API_URL); // or whatever your base URL variable is
console.log('📡 Making request to:', `${API_URL}/api/auth/google`);
```

Then check the console/logs when you try to sign in.

### Option 2: Check Network Tab

1. Open browser DevTools (F12)
2. Go to Network tab
3. Try to sign in
4. Look for the request to `/api/auth/google`
5. Check the **Request URL** - it should show your production URL

### Option 3: Test Diagnostic Endpoint from Client

Add a test in your client app:

```typescript
// Test if production is reachable
fetch('http://arrow-crossword-alb-751590434.eu-north-1.elb.amazonaws.com/api/diagnostic')
  .then(res => res.json())
  .then(data => {
    console.log('✅ Production backend is reachable:', data);
  })
  .catch(err => {
    console.error('❌ Cannot reach production backend:', err);
  });
```

## Common Issues

### 1. Client Still Using Localhost
**Symptom:** No logs in CloudWatch, error says "Network request failed"

**Fix:** Update your client's API URL to production

### 2. CORS Issues
**Symptom:** Requests show in Network tab but fail with CORS error

**Fix:** Already handled in backend, but verify `CLIENT_URL` is set correctly

### 3. HTTPS vs HTTP
**Symptom:** Browser blocks mixed content (HTTPS page trying to load HTTP API)

**Fix:** 
- Either use HTTPS for your client app
- Or add HTTPS listener to ALB (recommended for production)

### 4. Environment Variables Not Set
**Symptom:** Client uses default localhost URL

**Fix:** Set production environment variables when building/deploying client

## Next Steps

1. **Find your client's API configuration** - Search for "localhost", "3000", "api/auth"
2. **Update it to use production URL** - Replace with ALB DNS name
3. **Rebuild/redeploy your client app**
4. **Test again** - Check CloudWatch logs to see if requests arrive

## Verify Requests Are Reaching Production

After updating your client:

1. Try to sign in
2. Immediately check CloudWatch logs:
   ```bash
   aws logs tail /ecs/arrow-crossword-backend --region eu-north-1 --follow
   ```
3. You should see:
   - `📥 POST /api/auth/google` - Request received
   - `🔍 Verifying Google token...` - Processing
   - Either success or detailed error

## Still Not Working?

If you've updated the client URL but still no logs:

1. **Check if client is actually using the new URL** - Add console.log
2. **Check browser console** - Look for CORS or network errors
3. **Check if client is cached** - Clear cache, hard refresh
4. **Verify client was rebuilt** - Make sure new build includes the updated URL
