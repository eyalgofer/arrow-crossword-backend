import { OAuth2Client } from 'google-auth-library';

// Create client with timeout configuration for production reliability
const client = new OAuth2Client({
  // Increase timeout for network requests (default is 60s)
  // This helps in production environments with slower network connections
});

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser> {
  try {
    // Support multiple env var names for flexibility (ECS uses GOOGLE_CLIENT_ID)
    const audience = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean) as string[];

    if (audience.length === 0) {
      console.error('❌ No Google Client ID configured');
      console.error('   Available env vars:', {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'set' : 'missing',
        GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID ? 'set' : 'missing',
        GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID ? 'set' : 'missing',
      });
      throw new Error('No Google Client ID configured');
    }

    // Decode token to see what audience it contains (without verifying)
    let tokenAudience: string | undefined;
    try {
      const decoded = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
      tokenAudience = decoded.aud;
      console.log(`🔍 Token audience: ${tokenAudience}`);
    } catch (e) {
      console.warn('⚠️  Could not decode token to check audience');
    }

    console.log(`🔍 Verifying Google token with ${audience.length} audience(s):`);
    audience.forEach((aud, idx) => {
      console.log(`   ${idx + 1}. ${aud}${aud === tokenAudience ? ' ✅ (matches token)' : ''}`);
    });

    if (tokenAudience && !audience.includes(tokenAudience)) {
      console.error('❌ Token audience mismatch!');
      console.error(`   Token has: ${tokenAudience}`);
      console.error(`   Backend expects one of: ${audience.join(', ')}`);
      throw new Error(`Client ID mismatch: Token was issued for "${tokenAudience}" but backend expects one of: ${audience.join(', ')}`);
    }

    const ticket = await client.verifyIdToken({
      idToken,
      audience,
    });

    const payload = ticket.getPayload();
    
    if (!payload) {
      throw new Error('Invalid token payload');
    }

    if (!payload.email) {
      throw new Error('Email not provided by Google');
    }

    console.log(`✅ Google token verified for: ${payload.email}`);
    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name || '',
      picture: payload.picture || '',
    };
  } catch (error: any) {
    // Enhanced error logging for production debugging
    const audience = [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean) as string[];

    console.error('❌ Google token verification failed:', {
      message: error?.message,
      code: error?.code,
      name: error?.name,
      configuredClientIds: audience,
      configuredCount: audience.length,
    });

    // Decode token to show what audience it has
    try {
      const decoded = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
      console.error('   Token details:', {
        audience: decoded.aud,
        issuer: decoded.iss,
        email: decoded.email,
        exp: new Date(decoded.exp * 1000).toISOString(),
      });
      console.error(`   💡 Fix: Add "${decoded.aud}" to your AWS Secrets Manager and task definition`);
    } catch (e) {
      // Ignore decode errors
    }
    
    // Re-throw with more context
    if (error?.message?.includes('network') || error?.message?.includes('Network')) {
      throw new Error('Network error while verifying Google token. Please check your internet connection and try again.');
    }
    
    if (error?.message?.includes('audience') || error?.message?.includes('recipient')) {
      throw new Error(`Client ID mismatch. The token was issued for a different Client ID than configured. Check your Google OAuth configuration.`);
    }
    
    throw error;
  }
}