'use client';

import { UIMessage } from 'ai';
import { useState } from 'react';
import PDFViewer from './PDFViewer';

interface ChatMessageProps {
  message: UIMessage;
  isLast: boolean;
  onClarificationSelect?: (option: string) => void;
}

interface VectorSearchResult {
  id: string;
  doc_id: string;
  content: string;
  similarity: number;
  metadata: {
    chunkId: string;
    pageNumber: number;
    chunkType: string;
    originalContent?: string;
  };
}

export default function ChatMessage({ message,  isLast, onClarificationSelect }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfDocuments, setPdfDocuments] = useState<{ doc_id: string; pageNumber: number; chunkText: string; url: string }[]>([]);

  const handleClarificationClick = (option: string) => {
    if (onClarificationSelect) {
      onClarificationSelect(option);
    }
  };

  const handleDocumentClick = (doc_id: string, pageNumber: number, chunkText: string) => {
    console.log('handleDocumentClick called with:', { doc_id, pageNumber, chunkText: chunkText?.substring(0, 50) });
    
    if (!doc_id || doc_id === 'undefined') {
      console.error('Invalid doc_id:', doc_id);
      return;
    }
    
    const url = `https://brdr.hkma.gov.hk/eng/doc-ldg/docId/getPdf/${doc_id}/${doc_id}.pdf`;
    console.log("Generated PDF URL:", url);
    
    const newDoc = {
      doc_id,
      pageNumber, 
      chunkText,
      url
    };
    
    // Add or update document in the list 
    setPdfDocuments(prev => {
      const existing = prev.find(doc => doc.doc_id === doc_id && doc.pageNumber === pageNumber);
      if (existing) {
        // Update existing document with same doc_id and page number
        return prev.map(doc => (doc.doc_id === doc_id && doc.pageNumber === pageNumber) ? newDoc : doc);
      } else {
        // Add new document
        const updated = [...prev, newDoc];
        return updated;
      }
    });
    
    setIsPDFViewerOpen(true);
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${isLast ? 'animate-slide-in-right' : ''}`}>
      <div className={`max-w-[80%] lg:max-w-[70%] xl:max-w-[60%] ${isUser ? 'order-2' : 'order-1'}`}>
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
            console.log("part is", part, "with index", index)
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

              case  'tool-get_date_time_from_query': {
                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={index} className="space-y-3">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span> Retrieving date and time...
                      </div>
                    );
                    
                  case 'input-available':
                    
                  case 'output-available':
                    
                  case 'output-error':
                    return (
                      <div key={index} className="space-y-3">
                        Error retrieving date and time: {part.errorText}...
                      </div>
                    );
                }
              }
              case 'tool-tell_the_user_the_answer': {
                switch (part.state) {
                  case 'input-streaming':
                    return (
                      <div key={index} className="space-y-3">
                        <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span> 
                      </div>
                    );
                  
                  case 'input-available':
                    
                  case 'output-available':
                   
                  
                  case 'output-error':
                    return (
                      <div key={index} className="space-y-3">
                        Error generating answer: {part.errorText}...
                      </div>
                    );
                  }
              }
            
              case 'tool-find_relevant_brdr_document_data': {
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
                          <strong>Search Query:</strong> {(part.input as { question: string }).question}
                         
                        </div>
                      </div>
                    );
                  case 'output-available':
                    const output = part.output as VectorSearchResult[];
                    return (
                      <div key={callId} className="space-y-3">
                        {/* the case of null return value*/}
                        <div>
                          {output === null && (
                            <div className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
                              ❌ Search error: Sorry, I encountered an internal function error while retrieving data from the knowledge base. This could be due to timeout, connectivity issues, or database problems. Please try again in a moment.
                            </div>
                          )}
                        </div>

                        {/* the case of output is not null*/}
                        
                        {output && output.length > 0 && (
                          <div className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
                              <div className="font-semibold text-green-800">Vector Search Results</div>
                              <div className="mt-2 space-y-1 text-xs">
                                <div>📄 Chunks found: {output ? output.length : 0}</div>
                                <div>🎯 Similarity threshold: Applied</div>
                                <div>🔍 Search type: Vector semantic search</div>
                              </div>
                            </div>
                        )}
                      
                        {/* Document Chunks Display */}
                        {output && output.length > 0 && (
                          <div className="text-xs bg-purple-50 p-3 rounded-lg border border-purple-200">
                            <div className="font-semibold text-purple-800 mb-2">Source Document Chunks</div>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {output.map((chunk: VectorSearchResult, idx: number) => (
                                <div key={chunk.id} className="bg-white p-3 rounded border border-purple-200">
                                  <div className="flex items-start justify-between mb-2">
                                    <button
                                      onClick={() => {
                                        console.log('Clicking document:', chunk.doc_id, chunk.content.substring(0, 50));
                                        console.log('Metadata when clicking:', chunk.metadata);
                                        handleDocumentClick(
                                          chunk.doc_id, 
                                          chunk.metadata?.pageNumber || 1, 
                                          chunk.content
                                        );
                                      }}
                                      className="text-purple-600 hover:text-purple-800 hover:underline transition-colors font-medium text-sm flex items-center space-x-1"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                      <span>📄 {chunk.doc_id}</span>
                                    </button>
                                    <div className="text-xs text-gray-500">
                                      Similarity: {(chunk.similarity * 100).toFixed(1)}%
                                    </div>
                                  </div>
                                  
                                  <div className="text-xs text-gray-600 mb-2">
                                    {chunk.metadata ? (
                                      <>
                                        <span className="font-medium">Chunk ID:</span> {chunk.metadata.chunkId} | 
                                        <span className="font-medium"> Page:</span> {chunk.metadata.pageNumber} | 
                                        <span className="font-medium"> Type:</span> {chunk.metadata.chunkType}
                                      </>
                                    ) : (
                                      <span className="font-medium text-red-500">No metadata available</span>
                                    )}
                                    {/* Debug metadata */}
                                    {(() => { console.log('Chunk metadata:', chunk.metadata); return null; })()}
                                  </div>
                                  
                                  <div className="text-xs bg-gray-50 p-2 rounded border">
                                    <div className="font-semibold mb-1 text-gray-700">Chunk Content:</div>
                                    <div className="text-gray-600 max-h-20 overflow-y-auto">
                                      {chunk.content.substring(0, 300)}{chunk.content.length > 300 ? '...' : ''}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Quick PDF Access */}
                        {output && output.length > 0 && (
                          <div className="text-xs bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                            <div className="font-semibold text-indigo-800 mb-2">📖 Quick PDF Access</div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(() => {
                                // Create a map to store unique documents with their first occurrence and chunk count
                                const uniqueDocuments = new Map();
                                output.forEach(chunk => {
                                  if (!uniqueDocuments.has(chunk.doc_id)) {
                                    uniqueDocuments.set(chunk.doc_id, {
                                      chunk: chunk,
                                      count: output.filter(c => c.doc_id === chunk.doc_id).length
                                    });
                                  }
                                });
                                
                                // Convert to array and show all unique documents
                                return Array.from(uniqueDocuments.entries()).map(([doc_id, data]) => (
                                  <button
                                    key={doc_id}
                                    onClick={() => {
                                      console.log('Quick access clicking document:', doc_id, data.chunk.metadata?.pageNumber, data.chunk.content.substring(0, 50));
                                      console.log('Quick access metadata:', data.chunk.metadata);
                                      handleDocumentClick(
                                        doc_id, 
                                        data.chunk.metadata?.pageNumber || 1, 
                                        data.chunk.content || ''
                                      );
                                    }}
                                    className="text-left p-2 bg-white rounded border border-indigo-200 hover:bg-indigo-50 transition-colors"
                                  >
                                    <div className="font-medium text-indigo-700 text-xs">📄 {doc_id}</div>
                                    <div className="text-xs text-gray-500">Page {data.chunk.metadata?.pageNumber || 1}</div>
                                    <div className="text-xs text-gray-400 mt-1">
                                      {data.count} chunk{data.count > 1 ? 's' : ''}
                                    </div>
                                  </button>
                                ));
                              })()}
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

              // case 'tool-clarifyQuery': {
              //   const callId = part.toolCallId;

              //   switch (part.state) {
              //     case 'input-streaming':
              //       return (
              //         <div key={callId} className="flex items-center space-x-2">
              //           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              //           <span>Preparing clarification request...</span>
              //         </div>
              //       );
              //     case 'input-available':
              //       return (
              //         <div key={callId} className="space-y-3">
              //           <div className="text-sm bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              //             <div className="font-semibold text-yellow-800">Clarification Needed</div>
              //             <div className="mt-2">{(part.input as { message: string }).message}</div>
              //             {(part.input as any).options && (
              //               <div className="mt-3 space-y-2">
              //                 <div className="text-xs font-medium text-yellow-700">Please select an option:</div>
              //                 {(part.input as any).options.map((option: string, idx: number) => (
              //                   <button
              //                     key={idx}
              //                     onClick={() => handleClarificationClick(option)}
              //                     className="block w-full text-left px-3 py-2 bg-white border border-yellow-300 rounded-md hover:bg-yellow-50 transition-all duration-300 hover:scale-105 shadow-sm text-sm font-medium"
              //                   >
              //                     {option}
              //                   </button>
              //                 ))}
              //               </div>
              //             )}
              //           </div>
              //         </div>
              //       );
              //     case 'output-available':
              //       return (
              //         <div key={callId} className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
              //           ✅ Query clarified: {part.output as string}
              //         </div>
              //       );
              //     case 'output-error':
              //       return (
              //         <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
              //           ❌ Clarification error: {part.errorText}
              //         </div>
              //       );
              //   }
              //   break;
              // }

              // case 'tool-analyzeDocument': {
              //   const callId = part.toolCallId;

              //   switch (part.state) {
              //     case 'input-streaming':
              //       return (
              //         <div key={callId} className="flex items-center space-x-2">
              //           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              //           <span>Analyzing documents...</span>
              //         </div>
              //       );
              //     case 'input-available':
              //       const input = part.input as { documentIds: string[]; analysisType: string };
              //       return (
              //         <div key={callId} className="space-y-3">
              //           <div className="text-sm bg-purple-50 p-3 rounded-lg border border-purple-200">
              //             <div className="font-semibold text-purple-800">Document Analysis</div>
              //             <div className="mt-2 space-y-1 text-xs">
              //               <div>📊 Analysis type: {input.analysisType}</div>
              //               <div>📄 Documents: {input.documentIds.length}</div>
              //             </div>
              //           </div>
              //         </div>
              //       );
              //     case 'output-available':
              //       const output = part.output as any;
              //       return (
              //         <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
              //           <div className="font-semibold text-green-800">Analysis Complete</div>
              //           <div className="mt-2 text-xs">
              //             {output.analysis}
              //             <div className="mt-1">📊 Documents processed: {output.documentCount}</div>
              //           </div>
              //         </div>
              //       );
              //     case 'output-error':
              //       return (
              //         <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
              //           ❌ Analysis error: {part.errorText}
              //         </div>
              //       );
              //   }
              //   break;
              // }

              // case 'tool-manageContext': {
              //   const callId = part.toolCallId;

              //   switch (part.state) {
              //     case 'input-streaming':
              //       return (
              //         <div key={callId} className="flex items-center space-x-2">
              //           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              //           <span>Managing context...</span>
              //         </div>
              //       );
              //     case 'input-available':
              //       const input = part.input as { action: string; criteria?: string };
              //       return (
              //         <div key={callId} className="space-y-3">
              //           <div className="text-sm bg-indigo-50 p-3 rounded-lg border border-indigo-200">
              //             <div className="font-semibold text-indigo-800">Context Management</div>
              //             <div className="mt-2 space-y-1 text-xs">
              //               <div>⚙️ Action: {input.action}</div>
              //               {input.criteria && <div>🎯 Criteria: {input.criteria}</div>}
              //             </div>
              //           </div>
              //         </div>
              //       );
              //     case 'output-available':
              //       const output = part.output as any;
              //       return (
              //         <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
              //           ✅ {output.message}
              //         </div>
              //       );
              //     case 'output-error':
              //       return (
              //         <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
              //           ❌ Context management error: {part.errorText}
              //         </div>
              //       );
              //   }
              //   break;
              // }

              // case 'tool-refineQuery': {
              //   const callId = part.toolCallId;

              //   switch (part.state) {
              //     case 'input-streaming':
              //       return (
              //         <div key={callId} className="flex items-center space-x-2">
              //           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
              //           <span>Refining query...</span>
              //         </div>
              //       );
              //     case 'input-available':
              //       const input = part.input as { originalQuery: string; feedback: string };
              //       return (
              //         <div key={callId} className="space-y-3">
              //           <div className="text-sm bg-orange-50 p-3 rounded-lg border border-orange-200">
              //             <div className="font-semibold text-orange-800">Query Refinement</div>
              //             <div className="mt-2 space-y-1 text-xs">
              //               <div>🔍 Original: {input.originalQuery}</div>
              //               <div>💭 Feedback: {input.feedback}</div>
              //             </div>
              //           </div>
              //         </div>
              //       );
              //     case 'output-available':
              //       const output = part.output as any;
              //       return (
              //         <div key={callId} className="text-sm bg-green-50 p-3 rounded-lg border border-green-200">
              //           <div className="font-semibold text-green-800">Query Refined</div>
              //           <div className="mt-2 text-xs">
              //             <div>🔍 Refined query: {output.refinedQuery}</div>
              //           </div>
              //         </div>
              //       );
              //     case 'output-error':
              //       return (
              //         <div key={callId} className="text-sm text-red-500 bg-red-50 p-3 rounded-lg border border-red-200">
              //           ❌ Query refinement error: {part.errorText}
              //         </div>
              //       );
              //   }
              //   break;
              // }
            }
          }
          )}
        </div>
      </div>
      
      {/* PDF Viewer Sidebar */}
      <PDFViewer
        documents={pdfDocuments}
        isOpen={isPDFViewerOpen}
        onClose={() => setIsPDFViewerOpen(false)}
      />
    </div>
  );
} 