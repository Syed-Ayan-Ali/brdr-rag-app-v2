'use client';

// import { Message, MessageContent } from '@/components/message';
import { useChat } from '@ai-sdk/react';
// import { Response } from '@/components/response';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import SearchBar from './SearchBar';
import TestConnectionButton from './TestConnectionButton';
import PDFViewer from './PDFViewer';
// import { AuditTrailManager } from '@/lib/utils/AuditTrail';

interface PDFDocument {
  doc_id: string;
  pageNumber: number;
  chunkText: string;
  url: string;
}

interface MessagePDFs {
  [messageId: string]: PDFDocument[];
}

export default function ChatPanel() {
  // const [showAuditTrail, setShowAuditTrail] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isPDFViewerOpen, setIsPDFViewerOpen] = useState(false);
  const [pdfDocuments, setPdfDocuments] = useState<PDFDocument[]>([]);
  const [messagePDFs, setMessagePDFs] = useState<MessagePDFs>({});
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // const auditTrailManager = useRef<AuditTrailManager>(new AuditTrailManager());
  const currentSessionId = useRef<string>('');
  
  const { messages, sendMessage, addToolResult, status } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  
  const handleDocumentClick = (doc_id: string, pageNumber: number, chunkText: string, messageId?: string) => {
    console.log('handleDocumentClick called with:', { doc_id, pageNumber, chunkText: chunkText?.substring(0, 50), messageId });
    
    if (!doc_id || doc_id === 'undefined') {
      console.error('Invalid doc_id:', doc_id);
      return;
    }
    
    if (!messageId) {
      console.error('No message ID provided');
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
    
    // Update the message PDFs map
    setMessagePDFs(prevMap => {
      const existingDocs = prevMap[messageId] || [];
      const existing = existingDocs.find(doc => doc.doc_id === doc_id && doc.pageNumber === pageNumber);
      
      let updatedDocs;
      if (existing) {
        // Update existing document with same doc_id and page number
        updatedDocs = existingDocs.map(doc => 
          (doc.doc_id === doc_id && doc.pageNumber === pageNumber) ? newDoc : doc
        );
      } else {
        // Add new document
        updatedDocs = [...existingDocs, newDoc];
      }
      
      return {
        ...prevMap,
        [messageId]: updatedDocs
      };
    });
    
    // Set the active message ID
    setActiveMessageId(messageId);
    
    // Update the current PDF documents to display
    if (messageId) {
      const messageDocs = messagePDFs[messageId] || [];
      const updatedDocs = [...messageDocs];
      
      const existingIndex = updatedDocs.findIndex(doc => 
        doc.doc_id === doc_id && doc.pageNumber === pageNumber
      );
      
      if (existingIndex >= 0) {
        updatedDocs[existingIndex] = newDoc;
      } else {
        updatedDocs.push(newDoc);
      }
      
      setPdfDocuments(updatedDocs);
    }
    
    setIsPDFViewerOpen(true);
  };
  
  // Effect to update displayed PDFs when active message changes
  useEffect(() => {
    if (activeMessageId && messagePDFs[activeMessageId]) {
      setPdfDocuments(messagePDFs[activeMessageId]);
    }
  }, [activeMessageId, messagePDFs]);

  // const { messages, sendMessage, status } = useChat();

  // Initialize session on component mount
  // useEffect(() => {
  //   currentSessionId.current = auditTrailManager.current.startSession('current_user');
    
  //   // Log session start
  //   auditTrailManager.current.logQueryStart(
  //     'Session started',
  //     currentSessionId.current
  //   );
  // }, []);

  // Scroll behavior for sticky header
  useEffect(() => {
    const handleScroll = () => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const currentScrollY = container.scrollTop;
      const scrollThreshold = 50; // Minimum scroll before hiding header

      if (currentScrollY > lastScrollY && currentScrollY > scrollThreshold) {
        // Scrolling down - hide header
        setIsHeaderVisible(false);
      } else if (currentScrollY < lastScrollY || currentScrollY <= scrollThreshold) {
        // Scrolling up or at top - show header
        setIsHeaderVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [lastScrollY]);

  const handleSendMessage = (message: string) => {
    if (message.trim()) {
      // Log user message
      // auditTrailManager.current.logQueryStart(
      //   message,
      //   currentSessionId.current
      // );

      // // Log API request start
      // auditTrailManager.current.logToolCall(
      //   'api_request_start',
      //   { message },
      //   { status: 'started' },
      //   Date.now(),
      //   currentSessionId.current
      // );

      sendMessage({ text: message });
    }
  };

  const handleClarificationSelect = (option: string) => {
    // Log clarification selection
    // auditTrailManager.current.logToolCall(
    //   'clarification_select',
    //   { option },
    //   { status: 'selected' },
    //   Date.now(),
    //   currentSessionId.current
    // );

    // Send the selected option as a user message to continue the conversation
    sendMessage({ text: option });
  };

  // Check if assistant is currently responding
  const isAssistantResponding = status === 'streaming' || status === 'submitted';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sticky Header */}
      <div 
        className={`fixed top-0 left-0 right-0 z-40 transition-transform duration-300 ease-in-out ${
          isHeaderVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between p-6 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-lg">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            BRDR AI Assistant
          </h1>
          <div className="flex items-center space-x-4">
            {isAssistantResponding && (
              <div className="flex items-center space-x-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Assistant is responding...</span>
              </div>
            )}
            {/* <button
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              {showAuditTrail ? 'Hide' : 'Show'} Audit Trail
            </button> */}
          </div>
        </div>
      </div>

      {/* Main Content Area with dynamic layout */}
      <div className="flex flex-1 overflow-y-auto">
        {/* Chat Messages Container with top padding for sticky header */}
        <div 
          className={`flex-1 flex flex-col transition-all duration-300 ease-in-out ${
            isPDFViewerOpen ? 'pr-[50%] lg:pr-[45%] xl:pr-[40%]' : ''
          }`}
        >
          {/* Messages area with scrolling */}
          <div 
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 pt-24"
          >
            <div className="max-w-4xl mx-auto space-y-6">
              {messages?.map((message, index) => (
                <ChatMessage 
                  key={message.id} 
                  message={message} 
                  isLast={index === messages.length - 1}
                  onClarificationSelect={handleClarificationSelect}
                  onDocumentClick={(doc_id, pageNumber, chunkText) => 
                    handleDocumentClick(doc_id, pageNumber, chunkText, message.id)}
                />
              ))}
              
              {messages?.length === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-4">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Start a conversation</h3>
                  <p className="text-slate-500">Ask me anything and I will help you out!</p>
                </div>
              )}
            </div>
          </div>

          {/* Floating Search Bar - now inside the same container that shifts */}
          <div className="p-6 backdrop-blur-sm border-t border-slate-200">
            <div className="max-w-4xl mx-auto">
              <SearchBar 
                onSendMessage={handleSendMessage} 
                isDisabled={isAssistantResponding}
              />
            </div>
          </div>
        </div>

        {/* PDF Viewer (positioned absolute) */}
        {isPDFViewerOpen && (
          <div 
            className="fixed inset-y-0 right-0 w-[50%] lg:w-[45%] xl:w-[40%] bg-white shadow-2xl z-40 transition-transform duration-300 ease-in-out"
            style={{ transform: isPDFViewerOpen ? 'translateX(0)' : 'translateX(100%)' }}
          >
            <PDFViewer
              documents={pdfDocuments}
              isOpen={isPDFViewerOpen}
              onClose={() => setIsPDFViewerOpen(false)}
              activeMessageId={activeMessageId}
            />
          </div>
        )}
      </div>
    </div>
  );
}