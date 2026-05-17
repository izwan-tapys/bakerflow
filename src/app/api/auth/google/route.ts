import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bakerId = searchParams.get('baker_id');

    if (!bakerId) {
      return NextResponse.json({ error: 'Baker ID is required' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    if (!clientId) {
      return NextResponse.json({ error: 'Google Client ID is not configured' }, { status: 500 });
    }

    // Construct the Google OAuth Authorization URL manually
    const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    oauthUrl.searchParams.set('client_id', clientId);
    oauthUrl.searchParams.set('redirect_uri', redirectUri);
    oauthUrl.searchParams.set('response_type', 'code');
    oauthUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events');
    oauthUrl.searchParams.set('access_type', 'offline'); // ✨ Request offline refresh token
    oauthUrl.searchParams.set('prompt', 'consent');      // ✨ Force consent to guarantee refresh token is issued
    oauthUrl.searchParams.set('state', bakerId);          // Pass bakerId as state to read in callback

    return NextResponse.redirect(oauthUrl.toString());
  } catch (err: any) {
    console.error('Error in /api/auth/google:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
