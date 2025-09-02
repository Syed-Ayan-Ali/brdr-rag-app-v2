'use client';

import { UIMessage } from 'ai';

interface ChatMessageProps {
  message: UIMessage;
  addToolResult: (options: { tool: string; toolCallId: string; output: unknown }) => void;
  isLast: boolean;
  onClarificationSelect?: (option: string) => void;
}

export default function ChatMessage({ message, addToolResult, isLast, onClarificationSelect }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const handleClarificationClick = (option: string) => {
    if (onClarificationSelect) {
      onClarificationSelect(option);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isLast ? 'animate-slide-in-right' : ''}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Avatar */}
        <div className={`flex items-center mb-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 ${
            isUser 
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg' 
              : 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg'
          }`}>
            {isUser ? (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
          </div>
          <span className={`ml-2 text-sm font-medium transition-colors duration-300 ${
            isUser ? 'text-blue-600' : 'text-purple-600'
          }`}>
            {isUser ? 'You' : 'AI Assistant'}
          </span>
        </div>

        {/* Message Content */}
        <div className={`rounded-2xl px-4 py-3 shadow-lg transition-all duration-300 hover:shadow-xl ${
          isUser 
            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white' 
            : 'bg-white border border-slate-200 text-slate-800'
        }`}>
          {message.parts.map((part, index) => {
            switch (part.type) {
              case 'step-start':
                return index > 0 ? (
                  <div key={index} className="my-2">
                    <hr className="border-slate-200" />
                  </div>
                ) : null;

              case 'text':
                return (
                  <div key={index} className="whitespace-pre-wrap leading-relaxed">
                    {part.text}
                  </div>
                );

              case 'tool-searchDocuments': {
                const callId = part.toolCallId;

                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={callId} className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Searching documents...</span>
                      </div>
                    );
                  case 'input-available':
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                          <strong>Search Query:</strong> {(part.input as { query: string }).query}
                          {(part.input as any).searchType && (
                            <div className="mt-1 text-xs text-blue-600">
                              Strategy: {(part.input as any).searchType}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  case 'output-available':
                    const output = part.output as any;
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                          <div className="font-semibold text-green-800">Search Results</div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div>📄 Documents found: {output.documents}</div>
                            <div>🔍 Search strategy: {output.searchStrategy}</div>
                            <div>📝 Expanded queries: {output.expandedQueries}</div>
                            {output.analysis && (
                              <div>🎯 Intent: {output.analysis.intent}</div>
                            )}
                          </div>
                        </div>
                        
                        {/* Metrics Display */}
                        {output.metricsText && (
                          <div className="text-xs bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <div className="font-semibold text-blue-800 mb-2">Query Performance</div>
                            <div className="space-y-1 text-blue-700 whitespace-pre-line">
                              {output.metricsText}
                            </div>
                          </div>
                        )}
                        
                        {/* Document Links */}
                        {output.documentLinks && output.documentLinks.length > 0 && (
                          <div className="text-xs bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <div className="font-semibold text-purple-800 mb-2">Source Documents</div>
                            <div className="space-y-1">
                              {output.documentLinks.map((link: any, idx: number) => (
                                <a
                                  key={idx}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                                >
                                  📄 {link.docId}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {output.context && (
                          <div className="text-xs bg-gray-50 p-2 rounded border">
                            <div className="font-semibold mb-1">Retrieved Context:</div>
                            <div className="text-gray-600 max-h-32 overflow-y-auto">
                              {output.context.substring(0, 300)}...
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  case 'output-error':
                    return (
                      <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                        ❌ Search error: {part.errorText}
                      </div>
                    );
                }
                break;
              }

              case 'tool-clarifyQuery': {
                const callId = part.toolCallId;

                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={callId} className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Preparing clarification request...</span>
                      </div>
                    );
                  case 'input-available':
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                          <div className="font-semibold text-yellow-800">Clarification Needed</div>
                          <div className="mt-2">{(part.input as { message: string }).message}</div>
                          {(part.input as any).options && (
                            <div className="mt-3 space-y-2">
                              <div className="text-xs font-medium text-yellow-700">Please select an option:</div>
                              {(part.input as any).options.map((option: string, idx: number) => (
                                <button
                                  key={idx}
                                  onClick={() => handleClarificationClick(option)}
                                  className="block w-full text-left px-3 py-2 bg-white border border-yellow-300 rounded-md hover:bg-yellow-50 transition-all duration-300 hover:scale-105 shadow-sm text-sm font-medium"
                                >
                                  {option}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  case 'output-available':
                    return (
                      <div key={callId} className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
                        ✅ Query clarified: {part.output as string}
                      </div>
                    );
                  case 'output-error':
                    return (
                      <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                        ❌ Clarification error: {part.errorText}
                      </div>
                    );
                }
                break;
              }

              case 'tool-analyzeDocument': {
                const callId = part.toolCallId;

                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={callId} className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Analyzing documents...</span>
                      </div>
                    );
                  case 'input-available':
                    const input = part.input as { documentIds: string[]; analysisType: string };
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-purple-50 p-3 rounded-lg border border-purple-200">
                          <div className="font-semibold text-purple-800">Document Analysis</div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div>📊 Analysis type: {input.analysisType}</div>
                            <div>📄 Documents: {input.documentIds.length}</div>
                          </div>
                        </div>
                      </div>
                    );
                  case 'output-available':
                    const output = part.output as any;
                    return (
                      <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="font-semibold text-green-800">Analysis Complete</div>
                        <div className="mt-2 text-xs">
                          {output.analysis}
                          <div className="mt-1">📊 Documents processed: {output.documentCount}</div>
                        </div>
                      </div>
                    );
                  case 'output-error':
                    return (
                      <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                        ❌ Analysis error: {part.errorText}
                      </div>
                    );
                }
                break;
              }

              case 'tool-manageContext': {
                const callId = part.toolCallId;

                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={callId} className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Managing context...</span>
                      </div>
                    );
                  case 'input-available':
                    const input = part.input as { action: string; criteria?: string };
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                          <div className="font-semibold text-indigo-800">Context Management</div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div>⚙️ Action: {input.action}</div>
                            {input.criteria && <div>🎯 Criteria: {input.criteria}</div>}
                          </div>
                        </div>
                      </div>
                    );
                  case 'output-available':
                    const output = part.output as any;
                    return (
                      <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                        ✅ {output.message}
                      </div>
                    );
                  case 'output-error':
                    return (
                      <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                        ❌ Context management error: {part.errorText}
                      </div>
                    );
                }
                break;
              }

              case 'tool-refineQuery': {
                const callId = part.toolCallId;

                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={callId} className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                        <span>Refining query...</span>
                      </div>
                    );
                  case 'input-available':
                    const input = part.input as { originalQuery: string; feedback: string };
                    return (
                      <div key={callId} className="space-y-3">
                        <div className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-200">
                          <div className="font-semibold text-orange-800">Query Refinement</div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div>🔍 Original: {input.originalQuery}</div>
                            <div>💭 Feedback: {input.feedback}</div>
                          </div>
                        </div>
                      </div>
                    );
                  case 'output-available':
                    const output = part.output as any;
                    return (
                      <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="font-semibold text-green-800">Query Refined</div>
                        <div className="mt-2 text-xs">
                          <div>🔍 Refined query: {output.refinedQuery}</div>
                        </div>
                      </div>
                    );
                  case 'output-error':
                    return (
                      <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                        ❌ Query refinement error: {part.errorText}
                      </div>
                    );
                }
                break;
              }

              default:
                return null;
            }
          })}
        </div>
      </div>
    </div>
  );
} 