import { TripPlan } from "@/types";

function convertTripFromBackend(raw: unknown): TripPlan {
  if (!raw) {
    return { days: [] };
  }

  const data = raw as {
    daily_itinerary?: {
      [day: string]: {
        date: string;
        activities: { time: string; description: string; location: string }[];
      };
    };
  };

  if (!data.daily_itinerary) {
    return { days: [] };
  }

  const days = Object.entries(data.daily_itinerary).map(([_, value]) => ({
    date: value.date,
    places: value.activities.map((act) => ({
      time: act.time,
      name: act.description,
      transport: "walk",
      lat: 0,
      lng: 0,
    })),
  }));

  return { days };
}


export async function postMessage(
  session_id: string, 
  content: string,
  onThought?: (thought: string) => void,
  onTrip?: (trip: TripPlan) => void,
  onError?: (error: string) => void
) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/messages`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      },
      body: JSON.stringify({ session_id, role: "user", content }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("postMessage failed:", res.status, res.statusText, errorText);
      throw new Error(`Failed to post message: ${res.status} ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error("No response body");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.thought && onThought) {
                // Split thought into characters and process with typewriter effect
                const chars = data.thought.split('');
                let currentText = '';
                
                for (const char of chars) {
                  currentText += char;
                  onThought(currentText);
                  await new Promise(resolve => setTimeout(resolve, 20)); // 20ms delay between characters
                }
              }
              
              if (data.trip && onTrip) {
                onTrip(convertTripFromBackend(data.trip));
              }
              
              if (data.error && onError) {
                console.error("Server error:", data.error);
                onError(data.error);
              }
            } catch (parseError) {
              console.error("Failed to parse SSE data:", parseError, "Line:", line);
              if (onError) {
                onError(`Failed to parse server response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
              }
            }
          }
        }
      }
    } catch (streamError) {
      console.error("Error reading stream:", streamError);
      if (onError) {
        onError(`Error reading response stream: ${streamError instanceof Error ? streamError.message : String(streamError)}`);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    console.error("Error in postMessage:", error);
    if (onError) {
      onError(`Error sending message: ${error instanceof Error ? error.message : String(error)}`);
    }
    throw error;
  }
}


export async function fetchMessages(session_id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/messages/${session_id}`
  );

  if (!res.ok) {
    console.error("fetchMessages failed:", res.status, res.statusText);
    throw new Error("Failed to fetch messages");
  }

  console.log("🔍 session_id in fetchMessages:", session_id);

  return await res.json();
}
