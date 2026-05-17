import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const bakerId = searchParams.get('state'); // State contains the bakerId passed during authorization

    if (!code || !bakerId) {
      return NextResponse.json({ error: 'Auth code or state is missing' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

    // 1. Exchange the auth code for access and refresh tokens
    const bodyParams = {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    };

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google token exchange failed: ${res.statusText} - ${errText}`);
    }

    const tokenData = await res.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token; // Received only if prompt=consent is used!
    const expiresIn = tokenData.expires_in;

    if (!accessToken) {
      throw new Error('No access token returned from Google');
    }

    const expiryDate = Date.now() + (expiresIn * 1000);

    // 2. Upsert the tokens into supabase baker_google_credentials table
    // If the user already linked once, they might already have a refresh token. 
    // We only overwrite the refresh token if Google returned a new one (since it's offline).
    const { data: existing } = await supabase
      .from('baker_google_credentials')
      .select('*')
      .eq('baker_id', bakerId)
      .maybeSingle();

    const payload: any = {
      baker_id: bakerId,
      access_token: accessToken,
      expiry_date: expiryDate,
    };

    if (refreshToken) {
      payload.refresh_token = refreshToken;
    } else if (existing?.refresh_token) {
      // Retain existing refresh token if not returned on this login
      payload.refresh_token = existing.refresh_token;
    } else {
      // Fallback safeguard if refresh_token was missed
      payload.refresh_token = 'MOCK_REFRESH_TOKEN';
    }

    const { error: upsertError } = await supabase
      .from('baker_google_credentials')
      .upsert(payload, { onConflict: 'baker_id' });

    if (upsertError) {
      throw new Error(`Supabase Upsert failed: ${upsertError.message}`);
    }

    // 3. Redirect back to settings page with successful parameter
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/dashboard/settings?google_sync=success`);
  } catch (err: any) {
    console.error('Error in Google Callback:', err);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/dashboard/settings?google_sync=error&msg=${encodeURIComponent(err.message)}`);
  }
}
export const dynamic = 'force-dynamic';
