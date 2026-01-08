#!/usr/bin/env node

/**
 * Quick script to verify Apple Sign In configuration
 * Run: node scripts/check-apple-config.js
 */

require('dotenv').config();

console.log('🔍 Checking Apple Sign In Configuration...\n');

const requiredVars = [
  'JWT_SECRET',
];

const appleVars = [
  'APPLE_BUNDLE_ID',
  'APPLE_CLIENT_ID',
  'APPLE_SERVICE_ID',
];

// Check required vars
console.log('📋 Required Environment Variables:');
let hasErrors = false;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${'*'.repeat(Math.min(value.length, 20))}...`);
  } else {
    console.log(`  ❌ ${varName}: MISSING`);
    hasErrors = true;
  }
});

// Check Apple vars
console.log('\n🍎 Apple Sign In Variables (at least one required):');
let hasAppleConfig = false;

appleVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    console.log(`  ✅ ${varName}: ${value}`);
    hasAppleConfig = true;
  } else {
    console.log(`  ⚠️  ${varName}: not set`);
  }
});

if (!hasAppleConfig) {
  console.log('\n  ❌ ERROR: No Apple configuration found!');
  console.log('     You need at least one of: APPLE_BUNDLE_ID, APPLE_CLIENT_ID, or APPLE_SERVICE_ID');
  hasErrors = true;
}

// Summary
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.log('❌ Configuration incomplete!');
  console.log('\n📝 Next steps:');
  console.log('   1. Add missing variables to your .env file');
  console.log('   2. See APPLE_SIGNIN_SETUP.md for detailed instructions');
  process.exit(1);
} else {
  console.log('✅ Configuration looks good!');
  console.log('\n💡 Tips:');
  console.log('   - Make sure your Bundle ID matches your iOS app');
  console.log('   - Test the endpoint: POST /api/auth/apple');
  process.exit(0);
}
