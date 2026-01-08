import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const client = jwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export interface AppleUser {
  appleId: string; // sub from token
  email: string;
  name?: string; // Only available on first sign-in
}

export async function verifyAppleToken(identityToken: string): Promise<AppleUser> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      getKey,
      {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        // Audience can be the app's bundle ID or service ID
        // We'll check it dynamically based on env vars
      },
      (err, decoded: any) => {
        if (err) {
          return reject(new Error(`Token verification failed: ${err.message}`));
        }

        if (!decoded) {
          return reject(new Error('Invalid token payload'));
        }

        // Check audience (can be bundle ID or service ID)
        const allowedAudiences = [
          process.env.APPLE_CLIENT_ID,
          process.env.APPLE_BUNDLE_ID,
          process.env.APPLE_SERVICE_ID,
        ].filter(Boolean) as string[];

        if (allowedAudiences.length > 0 && decoded.aud) {
          const audience = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
          const isValidAudience = audience.some((aud: string) => allowedAudiences.includes(aud));
          
          if (!isValidAudience) {
            return reject(new Error(`Invalid audience. Expected one of: ${allowedAudiences.join(', ')}, got: ${audience.join(', ')}`));
          }
        }

        // Apple provides 'sub' as the unique user identifier
        if (!decoded.sub) {
          return reject(new Error('User ID (sub) not found in token'));
        }

        // Email might be a proxy email if user chose to hide it
        // Apple provides email in the token, but it might be like: xyz@privaterelay.appleid.com
        const email = decoded.email;
        if (!email) {
          return reject(new Error('Email not provided by Apple'));
        }

        // Note: Apple does NOT include name in the identityToken
        // Name is only provided separately on first sign-in from the frontend
        // We'll use email username as fallback, but frontend should send name separately
        const name = decoded.email?.split('@')[0] || 'Apple User';

        resolve({
          appleId: decoded.sub,
          email: email,
          name: name, // Will be overridden by frontend-provided name if available
        });
      }
    );
  });
}
