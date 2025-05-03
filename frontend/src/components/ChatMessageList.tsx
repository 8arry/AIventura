import React from "react";

type ChatMessageListProps = {
  messages: { role: "user" | "assistant"; content: string }[];
};

const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages }) => {
  return (
    <div className="flex flex-col gap-0">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-gray-400 flex-col">
          <div className="size-16 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <p className="text-center">
            Enter your travel plan details to get started
          </p>
          <p className="text-sm mt-2 text-center max-w-xs">
            Example: "Plan a 3-day coffee tour in Munich for May"
          </p>
        </div>
      ) : (
        messages.map((msg, idx) => (
          <div 
            key={idx}
            className={`w-full py-6 px-6 ${
              msg.role === "user" ? "bg-white" : "bg-gray-50"
            }`}
          >
            <div className="max-w-3xl mx-auto flex">
              <div className="w-8 h-8 rounded-full flex items-center justify-center mr-4 flex-shrink-0">
                {msg.role === "user" ? (
                  <div className="bg-emerald-600 text-white size-full rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                ) : (
                  <div className="bg-emerald-200 text-emerald-800 size-full rounded-full flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium mb-1">
                  {msg.role === "user" ? "You" : "Travel Planner"}
                </p>
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default ChatMessageList;