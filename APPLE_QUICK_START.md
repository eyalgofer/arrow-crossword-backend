# Apple Sign In - Quick Start

## 🚀 Quick Setup (3 Steps)

### 1. Find Your Bundle ID
- **Xcode**: Project → Target → General → Bundle Identifier
- **Example**: `com.yourcompany.arrowcrossword`

### 2. Add to `.env` file
```bash
APPLE_BUNDLE_ID=com.mmr.crossword
```

### 3. Verify Configuration
```bash
npm run check:apple
```

That's it! 🎉

---

## 📝 Full Details

**First Time Setup?** Start here:
- **[APPLE_DEVELOPER_SETUP.md](./APPLE_DEVELOPER_SETUP.md)** - Complete step-by-step guide for Apple Developer Console and App Store Connect

**Already Set Up?** See:
- **[APPLE_SIGNIN_SETUP.md](./APPLE_SIGNIN_SETUP.md)** - Production setup (AWS Secrets Manager), ECS task definition updates
- **[APPLE_TROUBLESHOOTING.md](./APPLE_TROUBLESHOOTING.md)** - Troubleshooting common issues

---

## 🔍 Current Status

Run this to check your setup:
```bash
npm run check:apple
```

---

## 🧪 Test the Endpoint

Once configured, test with:
```bash
POST /api/auth/apple
Body: {
  "identityToken": "your-apple-token",
  "name": "User Name"  // optional, only on first sign-in
}
```

---

## ⚠️ Important Notes

- **Bundle ID must match exactly** (case-sensitive)
- **Name is only provided on first sign-in** - frontend should send it
- **Email might be a proxy** - Apple provides `xyz@privaterelay.appleid.com` if user hides email
- **iOS only** - Apple Sign In only works on iOS devices
