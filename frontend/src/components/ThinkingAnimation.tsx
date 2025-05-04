"use client";

import React from 'react';

type ThinkingAnimationProps = {
  thoughts: string[];
  isThinking: boolean;
};

const ThinkingAnimation: React.FC<ThinkingAnimationProps> = ({ thoughts, isThinking }) => {
  return (
    <div className="space-y-2">
      {thoughts.map((thought, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm text-gray-600">{thought}</p>
        </div>
      ))}
      {isThinking && (
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-sm text-gray-600">Thinking...</p>
        </div>
      )}
    </div>
  );
};

export default ThinkingAnimation; 