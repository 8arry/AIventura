// utils/session.ts

type Session = {
  id: string;
  title: string;
  lastUpdated: Date;
};

// Get current session ID or create a new one
export function getSessionId(): string {
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
    
    // Add to sessions list
    const sessions = listSessions();
    const newSession = {
      id,
      title: "New conversation",
      lastUpdated: new Date()
    };
    
    sessions.unshift(newSession);
    localStorage.setItem("sessions", JSON.stringify(sessions));
  }
  return id;
}

// Get list of all sessions
export function listSessions(): Session[] {
  try {
    const sessionsData = localStorage.getItem("sessions");
    if (sessionsData) {
      return JSON.parse(sessionsData);
    }
  } catch (error) {
    console.error("Error parsing sessions data:", error);
  }
  return [];
}

// Update or add session info
export function saveSession(id: string, title: string): void {
  const sessions = listSessions();
  const existingSessionIndex = sessions.findIndex(s => s.id === id);
  
  if (existingSessionIndex >= 0) {
    // Update existing session
    sessions[existingSessionIndex] = {
      ...sessions[existingSessionIndex],
      title: title || sessions[existingSessionIndex].title,
      lastUpdated: new Date()
    };
  } else {
    // Add new session
    sessions.unshift({
      id,
      title: title || "New conversation",
      lastUpdated: new Date()
    });
  }
  
  // Save updated sessions list
  localStorage.setItem("sessions", JSON.stringify(sessions));
}

// Switch to a different session
export function switchSession(id: string): string {
  localStorage.setItem("session_id", id);
  
  // Update this session's last updated time
  const sessions = listSessions();
  const sessionIndex = sessions.findIndex(s => s.id === id);
  
  if (sessionIndex >= 0) {
    sessions[sessionIndex].lastUpdated = new Date();
    localStorage.setItem("sessions", JSON.stringify(sessions));
  }
  
  return id;
}

// Delete a session
export function deleteSession(id: string): void {
  const sessions = listSessions().filter(s => s.id !== id);
  localStorage.setItem("sessions", JSON.stringify(sessions));
  
  // Also remove the messages for this session
  localStorage.removeItem(`session_messages_${id}`);
}