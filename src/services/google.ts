import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser> {
  // Support multiple env var names for flexibility (ECS uses GOOGLE_CLIENT_ID)
  const audience = [
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_WEB_CLIENT_ID,
    process.env.GOOGLE_IOS_CLIENT_ID,
  ].filter(Boolean) as string[];

  if (audience.length === 0) {
    throw new Error('No Google Client ID configured');
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

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name || '',
    picture: payload.picture || '',
  };
}