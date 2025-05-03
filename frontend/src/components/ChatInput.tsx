"use client";

import React, { useRef, useState, useEffect } from "react";
import BeatLoader from "react-spinners/BeatLoader";

type ChatInputProps = {
  onSend: (message: string) => Promise<void>;
  onPlanStart: () => Promise<void>;
  isLoading?: boolean;
};

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onPlanStart, isLoading }) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 150) + "px";
    }
  }, [message]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = async () => {
    if (!message.trim() || isLoading) return;

    await onSend(message);  
    await onPlanStart();    
    setMessage("");
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  return (
    <div className="w-full border-t border-gray-200 p-4 bg-white">
      <div className="max-w-3xl mx-auto relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your travel plan here..."
          className="w-full max-h-40 resize-none overflow-y-auto rounded-md border border-gray-300 py-3 pl-4 pr-10 text-sm text-gray-800 shadow-sm focus:border-emerald-500 focus:outline-none"
          rows={1}
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={isLoading || !message.trim()}
          className="absolute right-2 bottom-2 rounded-md p-2 transition hover:bg-gray-100 disabled:opacity-50"
          aria-label="Submit message"
        >
          {isLoading ? (
            <div className="size-5 flex items-center justify-center">
              <BeatLoader size={6} color="#10B981" />
            </div>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth={1.5} 
              stroke="currentColor" 
              className="size-5 text-emerald-600"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" 
              />
            </svg>
          )}
        </button>
        <p className="text-xs text-gray-500 mt-2 ml-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default ChatInput;