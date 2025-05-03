"use client";

import React, { useState } from "react";
import ChatInput from "@/components/ChatInput";
import ChatMessageList from "@/components/ChatMessageList";
import PlaceSearchMap from "@/components/PlaceSearchMap";
import { getSessionId } from "@/utils/session";
import { postMessage, fetchTripPlan } from "@/libs/api";
import { useLoadScript } from "@react-google-maps/api";
import { TripPlan } from "@/types";

const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function HomePage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!,
    libraries,
  });

  const handleSendMessage = async (message: string) => {
    setIsSending(true);
    const session_id = getSessionId();
    const userMessage: Message = { role: "user", content: message };
    
    // Add user message to chat immediately
    setMessages([...messages, userMessage]);
    
    try {
      const res = await postMessage(session_id, userMessage.content);
      if (res.status === 'ok') {
        // Add assistant response
        const assistantMessage: Message = { 
          role: "assistant", 
          content: "I've created a trip plan based on your request." 
        };
        setMessages(prevMessages => [...prevMessages, assistantMessage]);
        
        if (res.trip) {
          setTripPlan(res.trip);
        }
      } else {
        console.error("API response error:", res);
      }
    } catch (error) {
      console.error("Error posting message:", error);
      // Add error message from assistant
      const errorMessage: Message = { 
        role: "assistant", 
        content: "Sorry, I couldn't process your request. Please try again." 
      };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handlePlanStart = async () => {
    try {
      const plan = await fetchTripPlan();
      setTripPlan(plan);
    } catch (error) {
      console.error("Failed to fetch trip plan:", error);
    }
  };

  // Clear chat history and start new session
  const handleNewChat = () => {
    setMessages([]);
    setTripPlan(null);
    // Generate new session ID
    localStorage.removeItem("session_id");
    getSessionId();
  };

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-emerald-700 text-white p-4 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">Travel Planner</h1>
          <button 
            onClick={handleNewChat}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-800 rounded-md text-sm transition"
          >
            New Chat
          </button>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Chat panel */}
        <div className="flex flex-col w-1/2 border-r">
          <div className="flex-1 overflow-auto">
            <ChatMessageList messages={messages} />
          </div>
          <ChatInput onSend={handleSendMessage} onPlanStart={handlePlanStart} isLoading={isSending} />
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