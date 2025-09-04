'use client';

import { useState, useEffect, useRef } from 'react';

interface PDFDocument {
  doc_id: string;
  pageNumber: number;
  chunkText: string;
  url: string;
}

interface PDFViewerProps {
  documents: PDFDocument[];
  isOpen: boolean;
  onClose: () => void;
}

export default function PDFViewer({ documents, isOpen, onClose }: PDFViewerProps) {
  const [activeTab, setActiveTab] = useState(0);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  // Reset active tab when documents change
  useEffect(() => {
    if (documents.length > 0) {
      setActiveTab(0);
    }
  }, [documents]);

  // Scroll to active tab when it changes
  useEffect(() => {
    if (tabsContainerRef.current && documents.length > 0) {
      const tabElements = tabsContainerRef.current.querySelectorAll('button');
      if (tabElements[activeTab]) {
        tabElements[activeTab].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [activeTab, documents.length]);

  if (!isOpen || documents.length === 0) {
    return null;
  }

  // Filter out duplicate PDFs (same doc_id)
  const uniqueDocuments = documents.reduce((acc: PDFDocument[], current) => {
    const isDuplicate = acc.find(doc => doc.doc_id === current.doc_id);
    if (!isDuplicate) {
      acc.push(current);
    }
    return acc;
  }, []);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-2/3 lg:w-1/2 xl:w-2/5 bg-white shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="text-lg font-semibold text-gray-800">PDF Viewer <span className="text-sm font-normal text-gray-500">({uniqueDocuments.length} document{uniqueDocuments.length !== 1 ? 's' : ''})</span></h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Tab Navigation with Scrollbar */}
      <div 
        ref={tabsContainerRef}
        className="flex overflow-x-auto border-b border-gray-200 bg-white scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100"
        style={{ scrollbarWidth: 'thin' }}
      >
        {uniqueDocuments.map((doc, index) => (
          <button
            key={`${doc.doc_id}-${index}`}
            onClick={() => setActiveTab(index)}
            className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === index
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>📄</span>
              <span className="truncate max-w-24">{doc.doc_id}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Page {doc.pageNumber}
            </div>
          </button>
        ))}
      </div>

      {/* PDF Content */}
      <div className="flex-1 flex flex-col">
        {uniqueDocuments.map((doc, index) => (
          <div
            key={`${doc.doc_id}-content-${index}`}
            className={`flex-1 ${activeTab === index ? 'block' : 'hidden'}`}
          >
            {/* Document Info */}
            <div className="p-3 bg-yellow-50 border-b border-yellow-200">
              <div className="text-sm font-medium text-yellow-800 mb-2">
                📍 Highlighted Text from Page {doc.pageNumber}:
              </div>
              <div className="text-xs text-yellow-700 bg-yellow-100 p-3 rounded border-l-4 border-yellow-400">
                <div className="font-medium mb-1">Content Preview:</div>
                <div className="italic leading-relaxed">
                  &quot;{doc.chunkText.substring(0, 300)}{doc.chunkText.length > 300 ? '...' : ''}&quot;
                </div>
              </div>
              <div className="mt-2 text-xs text-yellow-600">
                💡 This text will be highlighted in the PDF when available
              </div>
            </div>

             {/* PDF Display - External Link Due to X-Frame-Options */}
             <div className="flex-1 flex items-center justify-center bg-gray-50">
               <div className="text-center p-8 max-w-md">
                 <div className="mb-6">
                   <svg className="w-16 h-16 mx-auto mb-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                   </svg>
                   <h3 className="text-lg font-semibold text-gray-800 mb-2">PDF Cannot be Embedded</h3>
                   <p className="text-sm text-gray-600 mb-4">
                     Due to security restrictions, this PDF cannot be displayed in an embedded frame. 
                     Please use the link below to view the document in a new tab.
                   </p>
                 </div>
                 
                 <div className="space-y-3">
                   <a
                     href={`${doc.url}#page=${doc.pageNumber}`}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                   >
                     <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                     </svg>
                     Open PDF (Page {doc.pageNumber})
                   </a>
                   
                   <div className="text-xs text-gray-500">
                     Document: {doc.doc_id}
                   </div>
                 </div>
                 
                 {/* Preview of what to look for */}
                 <div className="mt-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
                   <div className="text-xs font-medium text-yellow-800 mb-1">
                     📍 Look for this text on page {doc.pageNumber}:
                   </div>
                   <div className="text-xs text-yellow-700 italic">
                     &quot;{doc.chunkText.substring(0, 100)}{doc.chunkText.length > 100 ? '...' : ''}&quot;
                   </div>
                 </div>
               </div>
             </div>

            {/* Footer with document link and search functionality */}
            <div className="p-3 bg-gray-50 border-t border-gray-200 space-y-2">
              {/* Search hint */}
              <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded border border-blue-200">
                <div className="font-medium text-blue-700 mb-1">🔍 Search Tips:</div>
                <div className="space-y-1">
                  <div>• Use Ctrl+F (Windows) or Cmd+F (Mac) to search within the PDF</div>
                  <div>• Look for: &quot;{doc.chunkText.split(' ').slice(0, 5).join(' ')}...&quot;</div>
                </div>
              </div>
              
              {/* External link */}
              <div className="flex items-center justify-between">
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center space-x-1"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open in new tab</span>
                </a>
                
                <div className="text-xs text-gray-500">
                  Page {doc.pageNumber}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
