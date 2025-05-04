"use client";

import React, { useEffect, useState, useRef } from "react";
import ChatInput from "@/components/ChatInput";
import ChatMessageList from "@/components/ChatMessageList";
import PlaceSearchMap from "@/components/PlaceSearchMap";
import ThinkingAnimation from "@/components/ThinkingAnimation";
import { getSessionId, listSessions, saveSession, switchSession } from "@/utils/session";
import { postMessage } from "@/libs/api";
import { useLoadScript } from "@react-google-maps/api";
import { TripPlan } from "@/types";
import { v4 as uuidv4 } from "uuid";

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  trip?: TripPlan;
};

type Session = {
  id: string;
  title: string;
  lastUpdated: Date;
};

type ChatInputProps = {
  onSendMessage: (content: string) => Promise<void>;
  isLoading?: boolean;
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [sessionsList, setSessionsList] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>("");
  const [showSessions, setShowSessions] = useState(false);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [currentThought, setCurrentThought] = useState<string>("");
  const thoughtsEndRef = useRef<HTMLDivElement>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries,
  });

  // Load sessions list on component mount
  useEffect(() => {
    const sessions = listSessions();
    setSessionsList(sessions);
    
    // Get current session ID
    const sessionId = getSessionId();
    setCurrentSessionId(sessionId);
    
    // Try to load current session messages from local storage
    const sessionData = localStorage.getItem(`session_messages_${sessionId}`);
    if (sessionData) {
      try {
        setMessages(JSON.parse(sessionData));
      } catch (e) {
        console.error("Failed to parse session data:", e);
      }
    }
  }, []);

  // Save messages to local storage whenever they change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      localStorage.setItem(`session_messages_${currentSessionId}`, JSON.stringify(messages));
      
      // Update session title with first user message if available
      const firstUserMessage = messages.find(m => m.role === "user");
      if (firstUserMessage) {
        const title = firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? "..." : "");
        saveSession(currentSessionId, title);
        
        // Refresh sessions list
        setSessionsList(listSessions());
      }
    }
  }, [messages, currentSessionId]);

  const scrollToBottom = () => {
    thoughtsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [thoughts, currentThought]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setIsThinking(true);
    setThoughts([]);
    setCurrentThought("");

    try {
      await postMessage(
        currentSessionId,
        message,
        (thought) => {
          setCurrentThought(thought);
        },
        (trip) => {
          setTripPlan(trip);
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: "Here's your travel plan!",
              timestamp: new Date(),
              trip,
            },
          ]);
          setIsThinking(false);
          setCurrentThought("");
        },
        (error) => {
          console.error("Error:", error);
          setIsThinking(false);
          setCurrentThought("");
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setIsThinking(false);
      setCurrentThought("");
    }
  };

  // Create new session
  const handleNewChat = () => {
    setMessages([]);
    setTripPlan(null);
    // Generate new session ID
    localStorage.removeItem("session_id");
    const newSessionId = getSessionId();
    setCurrentSessionId(newSessionId);
    
    // Update sessions list
    setSessionsList(listSessions());
    
    // Hide sessions panel if it was open
    setShowSessions(false);
  };
  
  // Switch to an existing session
  const handleSwitchSession = (sessionId: string) => {
    const newSessionId = switchSession(sessionId);
    setCurrentSessionId(newSessionId);
    
    // Load messages from local storage
    const sessionData = localStorage.getItem(`session_messages_${newSessionId}`);
    if (sessionData) {
      try {
        setMessages(JSON.parse(sessionData));
      } catch (e) {
        console.error("Failed to parse session data:", e);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
    
    // Close sessions panel
    setShowSessions(false);
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-emerald-700 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Travel Planner</h1>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowSessions(!showSessions)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-800 rounded-md text-sm transition flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              Sessions
            </button>
            <button 
              onClick={handleNewChat}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-800 rounded-md text-sm transition flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Chat
            </button>
          </div>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel with integrated input */}
        <div className="flex flex-col w-1/2 border-r relative">
          {/* Sessions panel (slide-in from left) */}
          {showSessions && (
            <div className="absolute inset-0 bg-white z-10 flex flex-col shadow-lg">
              <div className="bg-emerald-50 p-4 flex justify-between items-center border-b">
                <h2 className="font-medium">Your Sessions</h2>
                <button 
                  onClick={() => setShowSessions(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-auto p-2">
                {sessionsList.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No sessions yet</div>
                ) : (
                  <ul className="divide-y">
                    {sessionsList.map(session => (
                      <li key={session.id}>
                        <button
                          className={`w-full text-left p-3 hover:bg-gray-50 flex justify-between items-center ${
                            session.id === currentSessionId ? 'bg-emerald-50' : ''
                          }`}
                          onClick={() => handleSwitchSession(session.id)}
                        >
                          <div>
                            <p className="font-medium truncate">{session.title || "New conversation"}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(session.lastUpdated).toLocaleString()}
                            </p>
                          </div>
                          {session.id === currentSessionId && (
                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded">
                              Current
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          
          {/* Chat messages area */}
          <div className="flex-1 overflow-auto">
            <ChatMessageList messages={messages} />
            {(isThinking || currentThought) && (
              <div className="flex items-start space-x-2 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white">AI</span>
                  </div>
                </div>
                <div className="flex-1 bg-gray-100 rounded-lg p-3">
                  {currentThought && (
                    <p className="text-gray-800 whitespace-pre-wrap">{currentThought}</p>
                  )}
                  {isThinking && !currentThought && (
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={thoughtsEndRef} />
          </div>
          
          {/* Chat input - now inside the chat panel */}
          <div className="border-t p-4">
            <ChatInput onSend={handleSendMessage} isLoading={isThinking} />
          </div>
        </div>
        
        {/* Map panel */}
        <div className="w-1/2 flex flex-col">
          <div className="p-4 bg-emerald-50 border-b">
            <h2 className="font-semibold text-lg text-emerald-800">Trip Visualization</h2>
          </div>
          <div className="flex-1 overflow-auto">
            {isLoaded ? (
              <PlaceSearchMap tripPlan={tripPlan} />
            ) : (
              <div className="text-center py-4">Loading map...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}