# Apple Sign In Setup Checklist

Quick visual checklist to ensure everything is configured correctly.

---

## ✅ Step-by-Step Checklist

### 1. Apple Developer Portal Setup

- [ ] **Access Developer Portal**
  - Go to: https://developer.apple.com/account/
  - Sign in with your Apple Developer account

- [ ] **Create/Verify App ID**
  - Navigate to: Certificates, Identifiers & Profiles → Identifiers
  - Create new App ID or select existing
  - Bundle ID: `com.mmr.crossword` (must match exactly!)
  - ✅ Enable **Sign In with Apple** capability
  - Click Register/Save

- [ ] **Verify Capability is Enabled**
  - Go back to your App ID
  - Confirm "Sign In with Apple" appears in Enabled Capabilities list

---

### 2. App Store Connect (Optional for Development)

- [ ] **Access App Store Connect**
  - Go to: https://appstoreconnect.apple.com/
  - Sign in with your Apple Developer account

- [ ] **Create New App**
  - Click "+" → New App
  - Select iOS platform
  - Bundle ID: Select `com.mmr.crossword`
  - Fill in app name and details
  - Click Create

**Note**: You don't need to submit the app to use Sign In with Apple for development/testing.

---

### 3. Xcode Configuration

- [ ] **Open Project in Xcode**
  - Open your iOS project

- [ ] **Set Bundle Identifier**
  - Select project → Target → General tab
  - Bundle Identifier: `com.mmr.crossword`
  - ✅ Must match Developer Portal exactly!

- [ ] **Add Sign In with Apple Capability**
  - Go to Signing & Capabilities tab
  - Click "+ Capability"
  - Add "Sign In with Apple"
  - ✅ Should appear in capabilities list

- [ ] **Configure Signing**
  - Team: Select your Apple Developer team
  - Provisioning Profile: Should auto-generate
  - ✅ No signing errors

---

### 4. Backend Configuration

- [ ] **Update .env File**
  ```bash
  APPLE_BUNDLE_ID=com.mmr.crossword
  ```

- [ ] **Verify Configuration**
  ```bash
  npm run check:apple
  ```
  - ✅ Should show: "Configuration looks good!"

---

### 5. Testing

- [ ] **Connect Real Device**
  - Connect iPhone via USB
  - ✅ Not using simulator (Apple Sign In doesn't work there)

- [ ] **Sign In with Apple ID**
  - Make sure you're signed in with Apple ID on device
  - Settings → [Your Name] → Verify Apple ID

- [ ] **Build and Run**
  - Select device in Xcode
  - Build and run (⌘R)
  - ✅ App installs successfully

- [ ] **Test Sign In**
  - Try Apple Sign In in your app
  - ✅ Should work without errors

- [ ] **Check Backend Logs**
  - Start backend: `npm run dev`
  - Try sign in
  - ✅ Should see: "🍎 Apple Sign-In request received"

---

## 🎯 Quick Verification

Run this command to check your backend config:
```bash
npm run check:apple
```

Expected output:
```
✅ Configuration looks good!
```

---

## 🐛 If Something's Wrong

### Backend Config Issue
- Check `.env` file has `APPLE_BUNDLE_ID=com.mmr.crossword`
- Run `npm run check:apple` to verify

### Developer Portal Issue
- Verify App ID exists: https://developer.apple.com/account/resources/identifiers/list
- Check "Sign In with Apple" is enabled on the App ID
- Bundle ID must match exactly (case-sensitive)

### Xcode Issue
- Verify Bundle Identifier matches: `com.mmr.crossword`
- Check "Sign In with Apple" capability is added
- Try cleaning build folder: Product → Clean Build Folder (⇧⌘K)

### Testing Issue
- Must test on real device (not simulator)
- Must be signed in with Apple ID on device
- Check backend is running and accessible

---

## 📚 Detailed Guides

- **First Time Setup**: See [APPLE_DEVELOPER_SETUP.md](./APPLE_DEVELOPER_SETUP.md)
- **Troubleshooting**: See [APPLE_TROUBLESHOOTING.md](./APPLE_TROUBLESHOOTING.md)
- **Production Setup**: See [APPLE_SIGNIN_SETUP.md](./APPLE_SIGNIN_SETUP.md)

---

## ✅ All Done?

Once all checkboxes are checked:
1. ✅ Developer Portal configured
2. ✅ Xcode configured
3. ✅ Backend configured
4. ✅ Testing on real device

Your Apple Sign In should work! 🎉
