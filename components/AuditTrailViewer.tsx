'use client';

import { useState, useEffect } from 'react';
import { AuditSession, AuditEvent } from '@/lib/utils/AuditTrail';

interface AuditTrailViewerProps {
  sessionId?: string;
  onClose?: () => void;
}

export default function AuditTrailViewer({ sessionId, onClose }: AuditTrailViewerProps) {
  const [sessions, setSessions] = useState<AuditSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<AuditSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuditTrail();
  }, []);

  const loadAuditTrail = () => {
    try {
      const stored = localStorage.getItem('audit_trail');
      if (stored) {
        const data = JSON.parse(stored);
        
        // Filter to show only current session if sessionId is provided
        if (sessionId) {
          const currentSession = data.find((s: AuditSession) => s.sessionId === sessionId);
          if (currentSession) {
            setSessions([currentSession]);
            setSelectedSession(currentSession);
          } else {
            setSessions([]);
            setSelectedSession(null);
          }
        } else {
          setSessions(data);
          if (data.length > 0) {
            setSelectedSession(data[data.length - 1]); // Show most recent session
          }
        }
      }
    } catch (error) {
      console.error('Failed to load audit trail:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'query_start':
        return '🔍';
      case 'tool_call':
        return '⚙️';
      case 'document_retrieval':
        return '📄';
      case 'llm_response':
        return '🤖';
      case 'user_warning':
        return '⚠️';
      case 'error':
        return '❌';
      case 'api_request_start':
        return '📡';
      case 'api_request_end':
        return '✅';
      case 'api_request_success':
        return '✅';
      case 'api_request_failed':
        return '❌';
      case 'tool_call_start':
        return '🔄';
      case 'tool_call_end':
        return '✅';
      case 'query_processing_end':
        return '🔍';
      default:
        return '📝';
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'query_start':
        return 'bg-blue-100 text-blue-800';
      case 'tool_call':
        return 'bg-purple-100 text-purple-800';
      case 'document_retrieval':
        return 'bg-green-100 text-green-800';
      case 'llm_response':
        return 'bg-indigo-100 text-indigo-800';
      case 'user_warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'api_request_start':
        return 'bg-cyan-100 text-cyan-800';
      case 'api_request_end':
        return 'bg-green-100 text-green-800';
      case 'api_request_success':
        return 'bg-green-100 text-green-800';
      case 'api_request_failed':
        return 'bg-red-100 text-red-800';
      case 'tool_call_start':
        return 'bg-orange-100 text-orange-800';
      case 'tool_call_end':
        return 'bg-green-100 text-green-800';
      case 'query_processing_end':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const exportSession = (session: AuditSession) => {
    const dataStr = JSON.stringify(session, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_trail_${session.sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const refreshAuditTrail = () => {
    setIsLoading(true);
    loadAuditTrail();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Audit Trail Viewer
          </h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshAuditTrail}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              title="Refresh audit trail"
            >
              🔄 Refresh
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex h-96">
        {/* Sessions List */}
        <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Sessions</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-gray-500">No audit sessions found</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => setSelectedSession(session)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSession?.sessionId === session.sessionId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(session.startTime)}
                    </div>
                    <div className="text-sm font-medium text-gray-900">
                      Session {session.sessionId.slice(-8)}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      {session.summary.totalQueries} queries, {session.summary.totalToolCalls} tools
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Events List */}
        <div className="flex-1 overflow-y-auto">
          {selectedSession ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    Session Details
                  </h3>
                  <p className="text-sm text-gray-500">
                    {formatTimestamp(selectedSession.startTime)} - {selectedSession.endTime ? formatTimestamp(selectedSession.endTime) : 'Active'}
                  </p>
                </div>
                <button
                  onClick={() => exportSession(selectedSession)}
                  className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Export
                </button>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-2xl font-bold text-gray-900">{selectedSession.summary.totalQueries}</div>
                  <div className="text-xs text-gray-600">Queries</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-2xl font-bold text-gray-900">{selectedSession.summary.totalToolCalls}</div>
                  <div className="text-xs text-gray-600">Tool Calls</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-2xl font-bold text-gray-900">{selectedSession.summary.totalDocumentsRetrieved}</div>
                  <div className="text-xs text-gray-600">Documents</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-2xl font-bold text-gray-900">{Math.round(selectedSession.summary.averageResponseTime)}ms</div>
                  <div className="text-xs text-gray-600">Avg Response</div>
                </div>
              </div>

              {/* Events */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Events</h4>
                {selectedSession.events.map((event) => (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-3">
                    <div className="flex items-start space-x-3">
                      <div className="text-lg">{getEventIcon(event.eventType)}</div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${getEventColor(event.eventType)}`}>
                            {event.eventType.replace('_', ' ')}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(event.timestamp)}
                          </span>
                        </div>
                        <div className="mt-2 text-sm text-black">
                          {event.eventType === 'query_start' && (
                            <div>
                              <strong>Query:</strong> {event.eventData.query}
                            </div>
                          )}
                          {event.eventType === 'tool_call' && (
                            <div>
                              <strong>Tool:</strong> {event.eventData.toolName}
                              <br />
                              <strong>Response Time:</strong> {event.eventData.responseTime}ms
                            </div>
                          )}
                          {event.eventType === 'document_retrieval' && (
                            <div>
                              <strong>Strategy:</strong> {event.eventData.searchStrategy}
                              <br />
                              <strong>Documents:</strong> {event.eventData.documents.length}
                              <br />
                              <strong>Cache Hit:</strong> {event.eventData.cacheHit ? 'Yes' : 'No'}
                            </div>
                          )}
                          {event.eventType === 'llm_response' && (
                            <div>
                              <strong>Confidence:</strong> {Math.round(event.eventData.confidence * 100)}%
                              <br />
                              <strong>Response Time:</strong> {event.eventData.responseTime}ms
                            </div>
                          )}
                          {event.eventType === 'user_warning' && (
                            <div>
                              <strong>Warning:</strong> {event.eventData.message}
                            </div>
                          )}
                                                     {event.eventType === 'error' && (
                             <div>
                               <strong>Error:</strong> {event.eventData.error}
                               <br />
                               <strong>Context:</strong> {event.eventData.context}
                             </div>
                           )}
                           {event.eventType === 'api_request_start' && (
                             <div>
                               <strong>Request ID:</strong> {event.eventData.requestId}
                               <br />
                               <strong>Query:</strong> {event.eventData.requestData.query}
                             </div>
                           )}
                           {event.eventType === 'api_request_end' && (
                             <div>
                               <strong>Request ID:</strong> {event.eventData.requestId}
                               <br />
                               <strong>Documents:</strong> {event.eventData.responseData.documents}
                               <br />
                               <strong>Response Time:</strong> {event.eventData.responseTime}ms
                             </div>
                           )}
                           {event.eventType === 'api_request_failed' && (
                             <div>
                               <strong>Request ID:</strong> {event.eventData.requestId}
                               <br />
                               <strong>Error:</strong> {event.eventData.error}
                               <br />
                               <strong>Response Time:</strong> {event.eventData.responseTime}ms
                             </div>
                           )}
                           {event.eventType === 'tool_call_start' && (
                             <div>
                               <strong>Tool:</strong> {event.eventData.toolName}
                               <br />
                               <strong>Input:</strong> {JSON.stringify(event.eventData.input).substring(0, 100)}...
                             </div>
                           )}
                           {event.eventType === 'tool_call_end' && (
                             <div>
                               <strong>Tool:</strong> {event.eventData.toolName}
                               <br />
                               <strong>Response Time:</strong> {event.eventData.responseTime}ms
                             </div>
                           )}
                           {event.eventType === 'query_processing_end' && (
                             <div>
                               <strong>Query:</strong> {event.eventData.query}
                               <br />
                               <strong>Response Time:</strong> {event.eventData.responseTime}ms
                             </div>
                           )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Select a session to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 