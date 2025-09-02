'use client';

import { useState } from 'react';

interface AuditWarningProps {
  variant?: 'info' | 'warning' | 'error';
  dismissible?: boolean;
  onDismiss?: () => void;
}

export default function AuditWarning({ 
  variant = 'warning', 
  dismissible = true, 
  onDismiss 
}: AuditWarningProps) {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
    }
  };

  const getIcon = () => {
    switch (variant) {
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className={`rounded-lg border p-4 mb-4 ${getVariantStyles()}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          {getIcon()}
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium">
            {variant === 'error' && 'Critical Notice'}
            {variant === 'info' && 'Important Information'}
            {variant === 'warning' && 'Regulatory Compliance Notice'}
          </h3>
          <div className="mt-2 text-sm">
            <p className="mb-2">
              <strong>AI Accuracy Disclaimer:</strong> This AI assistant provides information based on 
              retrieved documents but may not be completely accurate. Always verify responses against 
              official sources and consult with compliance experts when making regulatory decisions.
            </p>
            <p className="mb-2">
              <strong>Audit Trail:</strong> All interactions are logged for regulatory compliance and 
              audit purposes. Your queries, document selections, and AI responses are tracked to ensure 
              transparency and accountability.
            </p>
            <p className="mb-2">
              <strong>Document Verification:</strong> While the system retrieves relevant documents, 
              you are responsible for verifying the accuracy and applicability of information to your 
              specific regulatory context.
            </p>
            <p>
              <strong>Regulatory Responsibility:</strong> This tool assists with information retrieval 
              but does not constitute legal or regulatory advice. Final compliance decisions remain your 
              responsibility.
            </p>
          </div>
        </div>
        {dismissible && (
          <div className="ml-auto pl-3">
            <button
              onClick={handleDismiss}
              className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                variant === 'error' 
                  ? 'text-red-500 hover:bg-red-100 focus:ring-red-600' 
                  : variant === 'info'
                  ? 'text-blue-500 hover:bg-blue-100 focus:ring-blue-600'
                  : 'text-yellow-500 hover:bg-yellow-100 focus:ring-yellow-600'
              }`}
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 