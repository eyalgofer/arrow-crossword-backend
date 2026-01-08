# Apple Developer Console Setup Guide

Complete step-by-step guide to set up Apple Sign In in Apple Developer Console.

---

## 📋 Prerequisites

- Apple Developer Account (paid membership required: $99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/account/)
- Your app's Bundle ID ready (e.g., `com.mmr.crossword`)

---

## Step 1: Register Your App ID

### 1.1 Go to Apple Developer Portal
1. Visit: https://developer.apple.com/account/
2. Sign in with your Apple Developer account
3. Navigate to **Certificates, Identifiers & Profiles**

### 1.2 Create or Select App ID
1. Click **Identifiers** in the left sidebar
2. Click the **+** button (top left) to create a new identifier
3. Select **App IDs** and click **Continue**
4. Select **App** and click **Continue**

### 1.3 Configure App ID
1. **Description**: Enter a description (e.g., "Arrow Crossword App")
2. **Bundle ID**: 
   - Select **Explicit**
   - Enter your Bundle ID: `com.mmr.crossword`
   - ⚠️ **Must match exactly** what's in Xcode and your backend `.env`

3. **Capabilities**: Scroll down and check:
   - ✅ **Sign In with Apple** (this is the important one!)
   - ✅ Any other capabilities you need (Push Notifications, etc.)

4. Click **Continue**
5. Review and click **Register**

### 1.4 Verify Sign In with Apple is Enabled
1. Go back to **Identifiers**
2. Click on your App ID (`com.mmr.crossword`)
3. Verify **Sign In with Apple** is listed under **Enabled Capabilities**
4. If not, click **Edit** and enable it

---

## Step 2: Configure Sign In with Apple Service

### 2.1 Create Service ID (Optional but Recommended)

A Service ID is needed if you want to use Sign In with Apple on web or for backend verification.

1. In **Identifiers**, click **+** again
2. Select **Services IDs** and click **Continue**
3. **Description**: "Arrow Crossword Backend Service"
4. **Identifier**: `com.mmr.crossword.service` (or similar)
5. Click **Continue** and **Register**

### 2.2 Configure Service ID
1. Click on your Service ID
2. Check **Sign In with Apple**
3. Click **Configure** next to "Sign In with Apple"
4. **Primary App ID**: Select your app (`com.mmr.crossword`)
5. **Website URLs**:
   - **Domains**: Your backend domain (e.g., `api.yourapp.com`)
   - **Return URLs**: Your callback URL (e.g., `https://api.yourapp.com/auth/apple/callback`)
6. Click **Save**
7. Click **Continue** and **Save**

---

## Step 3: Register App in App Store Connect

### 3.1 Access App Store Connect
1. Visit: https://appstoreconnect.apple.com/
2. Sign in with your Apple Developer account
3. Click **My Apps**

### 3.2 Create New App
1. Click the **+** button (top left)
2. Select **New App**

### 3.3 Fill App Information
1. **Platform**: iOS
2. **Name**: Your app name (e.g., "Arrow Crossword")
3. **Primary Language**: Your app's language
4. **Bundle ID**: 
   - Select your App ID: `com.mmr.crossword`
   - If it doesn't appear, go back to Step 1 and make sure it's registered
5. **SKU**: Unique identifier (e.g., `arrow-crossword-001`)
6. **User Access**: Full Access (unless you need restricted access)

7. Click **Create**

### 3.4 Configure App Store Connect
1. Your app is now created in App Store Connect
2. You can fill in other details later (description, screenshots, etc.)
3. **Important**: You don't need to submit the app to enable Sign In with Apple for development

---

## Step 4: Configure Xcode Project

### 4.1 Open Your Project
1. Open your iOS project in Xcode
2. Select your project in the navigator
3. Select your app target

### 4.2 Set Bundle Identifier
1. Go to **General** tab
2. **Bundle Identifier**: Must be exactly `com.mmr.crossword`
3. Verify it matches your App ID in Developer Portal

### 4.3 Enable Sign In with Apple Capability
1. Go to **Signing & Capabilities** tab
2. Click **+ Capability**
3. Search for and add **Sign In with Apple**
4. It should appear in your capabilities list

### 4.4 Configure Signing
1. **Team**: Select your Apple Developer team
2. **Provisioning Profile**: Should auto-generate or select one that includes Sign In with Apple
3. If you see errors, click **Download Manual Profiles** or **Fix Issue**

---

## Step 5: Update Backend Configuration

### 5.1 Update .env File
```bash
# Use your Bundle ID
APPLE_BUNDLE_ID=com.mmr.crossword

# Optional: If you created a Service ID
APPLE_SERVICE_ID=com.mmr.crossword.service
APPLE_CLIENT_ID=com.mmr.crossword
```

### 5.2 Verify Configuration
```bash
npm run check:apple
```

---

## Step 6: Test on Device

### 6.1 Build and Run
1. Connect your iPhone via USB
2. Select your device in Xcode
3. Build and run (⌘R)

### 6.2 Test Sign In
1. Try Apple Sign In in your app
2. Check backend logs for requests
3. Verify it works!

---

## ✅ Verification Checklist

- [ ] App ID created in Apple Developer Portal
- [ ] Sign In with Apple enabled on App ID
- [ ] Bundle ID matches exactly: `com.mmr.crossword`
- [ ] App registered in App Store Connect (optional for dev)
- [ ] Xcode project has correct Bundle ID
- [ ] Sign In with Apple capability added in Xcode
- [ ] Backend `.env` has `APPLE_BUNDLE_ID=com.mmr.crossword`
- [ ] Testing on real device (not simulator)

---

## 🐛 Common Issues

### Issue: "App ID not found in App Store Connect"
**Solution**: 
- Make sure you created the App ID in Developer Portal first
- Wait a few minutes for it to sync
- Try refreshing App Store Connect

### Issue: "Capability not available"
**Solution**:
- Make sure you enabled it in Developer Portal first
- Check your Apple Developer membership is active
- Try removing and re-adding the capability in Xcode

### Issue: "Provisioning profile error"
**Solution**:
- Go to Developer Portal → Profiles
- Create a new Development Provisioning Profile
- Make sure it includes your App ID with Sign In with Apple
- Download and install it in Xcode

### Issue: "Bundle ID mismatch"
**Solution**:
- Verify Bundle ID is exactly the same everywhere:
  - Developer Portal App ID
  - Xcode Bundle Identifier
  - Backend `.env` file
- Case-sensitive!

---

## 📝 Quick Reference

**Developer Portal**: https://developer.apple.com/account/
- Certificates, Identifiers & Profiles → Identifiers

**App Store Connect**: https://appstoreconnect.apple.com/
- My Apps → Create New App

**Your Bundle ID**: `com.mmr.crossword`

**Backend Config**:
```bash
APPLE_BUNDLE_ID=com.mmr.crossword
```

---

## 🆘 Still Having Issues?

1. **Check Developer Portal**: Make sure Sign In with Apple is enabled on your App ID
2. **Check Xcode**: Verify capability is added and Bundle ID matches
3. **Check Backend**: Run `npm run check:apple` to verify config
4. **Check Logs**: Start backend with `npm run dev` and watch for requests
5. **Test on Device**: Must be a real iPhone, not simulator

---

## 📚 Additional Resources

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Xcode Capabilities Guide](https://developer.apple.com/documentation/xcode/adding-capabilities-to-your-app)
