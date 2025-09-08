'use client';

import { useState, useRef, useEffect } from 'react';

interface SearchBarProps {
  onSendMessage: (message: string) => void;
  isDisabled?: boolean;
}

export default function SearchBar({ onSendMessage, isDisabled = false }: SearchBarProps) {
  const [input, setInput] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isDisabled) {
      // Add to history only if it's different from the last query
      if (queryHistory.length === 0 || queryHistory[0] !== input) {
        setQueryHistory(prev => [input, ...prev.slice(0, 49)]); // Keep last 50 queries
      }
      
      onSendMessage(input);
      setInput('');
      setIsExpanded(false);
      setHistoryIndex(-1); // Reset history index after submission
    }
  };

  const handleFocus = () => {
    if (!isDisabled) {
      setIsFocused(true);
      setIsExpanded(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!input.trim()) {
      setIsExpanded(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isDisabled) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'ArrowUp' && !isDisabled) {
      e.preventDefault();
      if (queryHistory.length > 0) {
        // Move backward in history (older queries)
        const newIndex = Math.min(historyIndex + 1, queryHistory.length - 1);
        setHistoryIndex(newIndex);
        setInput(queryHistory[newIndex]);
        
        // Move cursor to end of input
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.selectionStart = inputRef.current.value.length;
            inputRef.current.selectionEnd = inputRef.current.value.length;
          }
        }, 0);
      }
    } else if (e.key === 'ArrowDown' && !isDisabled) {
      e.preventDefault();
      if (historyIndex > 0) {
        // Move forward in history (newer queries)
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(queryHistory[newIndex]);
      } else if (historyIndex === 0) {
        // At the newest history item, clear input
        setHistoryIndex(-1);
        setInput('');
      }
    }
  };

  // Auto-resize effect
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Auto-scroll to bottom when input is focused
  useEffect(() => {
    if (isFocused) {
      containerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isFocused]);
  
  // Load query history from localStorage on component mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('queryHistory');
      if (savedHistory) {
        setQueryHistory(JSON.parse(savedHistory));
      }
    } catch (error) {
      console.error('Failed to load query history:', error);
    }
  }, []);
  
  // Save query history to localStorage when it changes
  useEffect(() => {
    try {
      if (queryHistory.length > 0) {
        localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
      }
    } catch (error) {
      console.error('Failed to save query history:', error);
    }
  }, [queryHistory]);

  return (
    <div className="relative">
      {/* Floating Container */}
      <div
        ref={containerRef}
        className={`relative transition-all duration-300 ease-out ${
          isExpanded 
            ? 'scale-105 shadow-2xl' 
            : 'scale-100 shadow-lg'
        } ${isDisabled ? 'opacity-60' : ''}`}
      >
        {/* Background Glow Effect */}
        <div className={`absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 blur-xl transition-opacity duration-300 ${
          isFocused && !isDisabled ? 'opacity-100' : 'opacity-0'
        }`} />
        
        {/* Main Input Container */}
        <div className={`relative bg-white/90 backdrop-blur-sm rounded-2xl border-2 transition-all duration-300 ${
          isFocused && !isDisabled
            ? 'border-blue-500 shadow-xl' 
            : isDisabled
            ? 'border-slate-300 shadow-lg'
            : 'border-slate-200 shadow-lg hover:border-slate-300'
        }`}>
          <form onSubmit={handleSubmit} className="flex items-end p-4">
            {/* Input Field */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                placeholder={isDisabled ? "Assistant is responding..." : (isFocused ? "Type your message..." : "Ask me anything...")}
                className={`w-full bg-transparent outline-none text-slate-800 placeholder-slate-500 resize-none min-h-[20px] max-h-[120px] transition-all duration-300 ${
                  isDisabled ? 'cursor-not-allowed' : ''
                }`}
                style={{ height: 'auto' }}
                disabled={isDisabled}
              />
              
              {/* Character Counter and History Indicator */}
              {isFocused && !isDisabled && (
                <div className="absolute -bottom-6 left-0 text-xs flex items-center space-x-2">
                  <span className="text-slate-400">{input.length} characters</span>
                  {historyIndex >= 0 && (
                    <span className="text-blue-500">
                      History: {historyIndex + 1}/{queryHistory.length}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={!input.trim() || isDisabled}
              className={`ml-3 p-3 rounded-xl transition-all duration-300 transform ${
                input.trim() && !isDisabled
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl hover:scale-105'
                  : isDisabled
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <svg 
                className="w-5 h-5" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
                />
              </svg>
            </button>
          </form>

          {/* Quick Actions (always visible when not disabled) */}
          {!isDisabled && (
            <div className="px-4 pb-3 border-t border-slate-100">
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <span>Example queries:</span>
                <button
                  onClick={() => {
                    setInput('What are the Basel III requirements for tier 1 banks in Hong Kong?');
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Basel III HK
                </button>
                <button
                  onClick={() => {
                    setInput('What are the capital adequacy requirements for European banks under CRD IV?');
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                >
                  CRD IV Capital
                </button>
                <button
                  onClick={() => {
                    setInput('Show me best practices for effective RAG searching');
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                >
                  RAG Tips
                </button>
                <button
                  onClick={() => {
                    setInput('What does the Tech Maturity Stock-take conducted in January 2025 talk about?');
                    inputRef.current?.focus();
                  }}
                  className="px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                >
                  Tech Maturity
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Label */}
      <div className={`absolute -top-2 left-4 px-2 bg-white text-xs font-medium transition-all duration-300 ${
        (isFocused || input) 
          ? 'text-blue-500 opacity-100 transform -translate-y-1' 
          : 'text-slate-400 opacity-0'
      }`}>
        Message
      </div>
    </div>
  );
} 