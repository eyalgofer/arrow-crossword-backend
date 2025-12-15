import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  picture: string;
}

export async function verifyGoogleToken(idToken: string): Promise<GoogleUser> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: [
      process.env.GOOGLE_WEB_CLIENT_ID!,
      process.env.GOOGLE_IOS_CLIENT_ID!,
    ],
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