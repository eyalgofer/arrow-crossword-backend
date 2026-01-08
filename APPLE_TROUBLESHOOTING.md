# Apple Sign-In Troubleshooting Guide

## Error: "The authorization attempt failed for an unknown reason"

This error occurs on the **client side** before the request reaches your backend. Here's how to fix it:

---

## ✅ Quick Checklist

### 1. **Real Device Required**
- ❌ **Simulator**: Apple Sign-In does NOT work on iOS Simulator
- ✅ **Real Device**: Must test on a physical iPhone/iPad

### 2. **Apple ID Signed In**
- Make sure you're signed in with an Apple ID on the device
- Settings → [Your Name] → Check Apple ID is active

### 3. **Xcode Configuration**

#### Enable Sign in with Apple Capability:
1. Open your project in Xcode
2. Select your app target
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **Sign in with Apple**
6. Make sure it's enabled

#### Check Bundle ID:
1. In Xcode, go to **General** tab
2. Verify **Bundle Identifier** matches your backend config
3. Example: `com.mmr.crossword` (from your .env)

### 4. **Expo Configuration**

If using Expo, check `app.json` or `app.config.js`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.mmr.crossword",
      "config": {
        "usesAppleSignIn": true
      }
    }
  }
}
```

### 5. **Rebuild Required**
After making changes:
```bash
# For Expo
npx expo prebuild --clean
npx expo run:ios

# Or rebuild in Xcode
```

### 6. **Provisioning Profile**
- Make sure your provisioning profile includes "Sign in with Apple" capability
- In Apple Developer Portal → Certificates, Identifiers & Profiles
- Check your App ID has "Sign in with Apple" enabled

---

## 🔍 Debugging Steps

### Step 1: Check Backend Logs

Start your backend with verbose logging:
```bash
npm run dev
```

Then try signing in. You should see:
```
🍎 Apple Sign-In request received
   Headers: {...}
   Body keys: [...]
```

**If you DON'T see this log:**
- The request never reached your backend
- The error is 100% client-side
- Check the client-side configuration

**If you DO see this log:**
- The request reached your backend
- Check the error message in the logs

### Step 2: Test on Real Device

1. Connect your iPhone via USB
2. Select it as the build target in Xcode
3. Build and run on the device
4. Try Apple Sign-In

### Step 3: Check Device Settings

1. Settings → [Your Name] → Sign-In & Security
2. Make sure "Sign in with Apple" is available
3. Check if there are any restrictions

### Step 4: Verify Bundle ID Match

**Backend `.env`:**
```bash
APPLE_BUNDLE_ID=com.mmr.crossword
```

**Xcode Bundle Identifier:**
- Must be exactly: `com.mmr.crossword`
- Case-sensitive!

**Verify:**
```bash
npm run check:apple
```

---

## 🐛 Common Issues

### Issue 1: "Capability not found"
**Solution:** Add "Sign in with Apple" capability in Xcode

### Issue 2: "Invalid bundle ID"
**Solution:** 
- Check Bundle ID matches exactly
- Rebuild the app after changing Bundle ID

### Issue 3: "Not signed in with Apple ID"
**Solution:** Sign in with Apple ID on the device

### Issue 4: Works in development, fails in production
**Solution:**
- Check provisioning profile includes the capability
- Verify App ID in Apple Developer Portal has it enabled

### Issue 5: "Network error" or timeout
**Solution:**
- Check device has internet connection
- Verify backend is accessible from device
- Check CORS settings if testing from web

---

## 📱 Testing Checklist

- [ ] Testing on **real iPhone/iPad** (not simulator)
- [ ] Signed in with Apple ID on device
- [ ] "Sign in with Apple" capability enabled in Xcode
- [ ] Bundle ID matches backend config exactly
- [ ] App rebuilt after making changes
- [ ] Backend is running and accessible
- [ ] Backend logs show request received (if it reaches backend)

---

## 🔗 Additional Resources

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Expo Apple Sign In Guide](https://docs.expo.dev/guides/authentication/#apple)
- [React Native Apple Authentication](https://github.com/invertase/react-native-apple-authentication)

---

## 💡 Still Not Working?

1. **Check backend logs** - Run `npm run dev` and watch for requests
2. **Check Xcode console** - Look for detailed error messages
3. **Try a fresh build** - Clean build folder and rebuild
4. **Verify Apple Developer setup** - Check App ID configuration
5. **Test with a different Apple ID** - Sometimes account-specific issues

If the backend logs show the request, share the error message from the logs!
