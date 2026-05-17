import { supabase } from '@/lib/supabase';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

interface GoogleEventPayload {
  title: string;
  description: string;
  date: string;       // YYYY-MM-DD
  start_time: string; // HH:MM
  duration: number;   // Minutes
}

// 1. Get or Refresh Google Access Token automatically
export async function getOrRefreshAccessToken(bakerId: string): Promise<string | null> {
  try {
    // Fetch the credentials from Supabase
    const { data: creds, error } = await supabase
      .from('baker_google_credentials')
      .select('*')
      .eq('baker_id', bakerId)
      .maybeSingle();

    if (error || !creds) {
      return null;
    }

    const now = Date.now();
    // If the access token is still valid (with a 5-minute safety buffer), return it!
    if (Number(creds.expiry_date) > now + 300000) {
      return creds.access_token;
    }

    // Otherwise, refresh the token!
    const client_id = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    const client_secret = process.env.GOOGLE_CLIENT_SECRET || '';

    const bodyParams = {
      client_id,
      client_secret,
      refresh_token: creds.refresh_token,
      grant_type: 'refresh_token',
    };

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(bodyParams).toString(),
    });

    if (!res.ok) {
      throw new Error(`Google token refresh failed: ${res.statusText}`);
    }

    const tokenData = await res.json();
    const newAccessToken = tokenData.access_token;
    const newExpiry = Date.now() + (tokenData.expires_in * 1000);

    // Save the new access token back to Supabase
    await supabase
      .from('baker_google_credentials')
      .update({
        access_token: newAccessToken,
        expiry_date: newExpiry,
      })
      .eq('baker_id', bakerId);

    return newAccessToken;
  } catch (err) {
    console.error('Error in getOrRefreshAccessToken:', err);
    return null;
  }
}

// Helper to calculate end time string ISO based on start date, time and duration
function getEventTimes(dateStr: string, startTimeStr: string, durationMin: number) {
  // ISO date format construction e.g. "2026-05-18T14:00:00"
  const startObj = new Date(`${dateStr}T${startTimeStr}:00`);
  const endObj = new Date(startObj.getTime() + durationMin * 60 * 1000);

  // Return local time formatting aligned with Google Calendar API (GMT+8 Malaysia)
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  const toISOStringWithTZ = (d: Date) => {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return {
    startISO: toISOStringWithTZ(startObj),
    endISO: toISOStringWithTZ(endObj),
  };
}

// 2. Insert Event into Google Calendar
export async function insertGoogleEvent(bakerId: string, task: GoogleEventPayload): Promise<string | null> {
  try {
    const accessToken = await getOrRefreshAccessToken(bakerId);
    if (!accessToken) return null;

    const { startISO, endISO } = getEventTimes(task.date, task.start_time, task.duration);

    const body = {
      summary: task.title,
      description: task.description,
      start: {
        dateTime: startISO,
        timeZone: 'Asia/Kuala_Lumpur',
      },
      end: {
        dateTime: endISO,
        timeZone: 'Asia/Kuala_Lumpur',
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 10 }, // 10 minutes before sound notification
          { method: 'popup', minutes: 5 },
        ],
      },
    };

    const res = await fetch(GOOGLE_CALENDAR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Calendar Insert failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    return data.id; // Returns the Google Event ID!
  } catch (err) {
    console.error('Error inserting Google Event:', err);
    return null;
  }
}

// 3. Delete Event from Google Calendar (Instant Delete Sync)
export async function deleteGoogleEvent(bakerId: string, eventId: string): Promise<boolean> {
  try {
    const accessToken = await getOrRefreshAccessToken(bakerId);
    if (!accessToken) return false;

    const deleteUrl = `${GOOGLE_CALENDAR_URL}/${eventId}`;
    const res = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      throw new Error(`Google Calendar Delete failed: ${res.status} - ${errText}`);
    }

    return true;
  } catch (err) {
    console.error('Error deleting Google Event:', err);
    return false;
  }
}

// 4. Update/Patch Event in Google Calendar
export async function updateGoogleEvent(bakerId: string, eventId: string, task: GoogleEventPayload): Promise<boolean> {
  try {
    const accessToken = await getOrRefreshAccessToken(bakerId);
    if (!accessToken) return false;

    const { startISO, endISO } = getEventTimes(task.date, task.start_time, task.duration);
    const updateUrl = `${GOOGLE_CALENDAR_URL}/${eventId}`;

    const body = {
      summary: task.title,
      description: task.description,
      start: {
        dateTime: startISO,
        timeZone: 'Asia/Kuala_Lumpur',
      },
      end: {
        dateTime: endISO,
        timeZone: 'Asia/Kuala_Lumpur',
      },
    };

    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Calendar Update failed: ${res.status} - ${errText}`);
    }

    return true;
  } catch (err) {
    console.error('Error updating Google Event:', err);
    return false;
  }
}
