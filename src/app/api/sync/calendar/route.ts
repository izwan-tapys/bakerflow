import { NextResponse } from 'next/server';
import { insertGoogleEvent, deleteGoogleEvent } from '@/lib/services/googleCalendar';

export async function POST(request: Request) {
  try {
    const { baker_id, action, task, eventId } = await request.json();

    if (!baker_id || !action) {
      return NextResponse.json({ error: 'Missing baker_id or action' }, { status: 400 });
    }

    // A. HANDLE INSERT EVENT
    if (action === 'insert') {
      if (!task) {
        return NextResponse.json({ error: 'Missing task payload for insertion' }, { status: 400 });
      }

      const gEventId = await insertGoogleEvent(baker_id, task);
      
      if (!gEventId) {
        return NextResponse.json({ error: 'Failed to insert event into Google Calendar' }, { status: 500 });
      }

      return NextResponse.json({ success: true, google_event_id: gEventId });
    }

    // B. HANDLE DELETE EVENT
    if (action === 'delete') {
      if (!eventId) {
        return NextResponse.json({ error: 'Missing eventId for deletion' }, { status: 400 });
      }

      const success = await deleteGoogleEvent(baker_id, eventId);
      
      if (!success) {
        return NextResponse.json({ error: 'Failed to delete event from Google Calendar' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });
  } catch (err: any) {
    console.error('Error in secure calendar sync gateway:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
