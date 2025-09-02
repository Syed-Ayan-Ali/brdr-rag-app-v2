import { google } from '@ai-sdk/google';
import { convertToModelMessages, streamText, UIMessage } from 'ai';
import { z } from 'zod';
import { RAGOrchestratorFactory } from '@/lib/RAGOrchestrator';
import { logger, LogCategory } from '../../../lib/logging/Logger';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Initialize RAG orchestrator
let ragOrchestrator: any = null;

// Initialize the orchestrator
async function getOrchestrator() {
  if (!ragOrchestrator) {
    ragOrchestrator = await RAGOrchestratorFactory.createDefaultOrchestrator();
  }
  return ragOrchestrator;
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // Add system message with instructions for metrics and document links
  const systemMessage = {
    role: 'system' as const,
    content: `You are a helpful AI assistant for BRDR (Banking Returns Data Repository) documents. 

When responding to queries:
1. Provide accurate information based on the retrieved documents
2. Include the metrics information provided in your response when available
3. Mention the source documents and provide clickable links
4. Format your response clearly with proper sections

Always include the metrics and document links when they are provided in the tool results.`
  };

  // Log API request start
  logger.info(LogCategory.API, `API request start: ${requestId}`, {
    requestId,
    messagesCount: messages.length,
    timestamp: new Date().toISOString()
  });

  const result = streamText({
    model: google('gemini-2.0-flash'),
    messages: [systemMessage, ...convertToModelMessages(messages)],
    tools: {
      // Enhanced document search with multiple strategies
      searchDocuments: {
        description: 'Search for relevant documents in the BRDR database using keyword strategy',
        inputSchema: z.object({
          query: z.string().describe('The search query'),
          searchType: z.literal('keyword').optional().describe('Search strategy to use (currently only keyword search is enabled)'),
          limit: z.number().optional().describe('Number of original chunks to retrieve (default: 3 for advanced_rag, 5 for others)'),
          contextWindow: z.number().optional().describe('Number of surrounding chunks to include (±2 default for advanced_rag)'),
        }),
        execute: async ({ query, searchType = 'keyword', limit, contextWindow = 2 }: { query: string; searchType?: string; limit?: number; contextWindow?: number }) => {
          // Set appropriate defaults based on search type
          const defaultLimit = searchType === 'advanced_rag' ? 3 : 5;
          const finalLimit = limit || defaultLimit;
          const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          try {
            // Log tool call start
            logger.info(LogCategory.API, `Tool call start: ${toolId} - searchDocuments`, {
              toolId,
              toolName: 'searchDocuments',
              input: { query, searchType, limit: finalLimit, contextWindow }
            });
            
            // Use RAG orchestrator to process the query
            const orchestrator = await getOrchestrator();
            const response = await orchestrator.processQuery({
              query,
              searchType: searchType as 'keyword',
              limit: finalLimit,
              contextWindow,
              useCache: true,
              trackPerformance: true
            });

            // Log tool call success
            logger.info(LogCategory.API, `Tool call success: ${toolId}`, {
              toolId,
              auditSessionId: response.auditSessionId,
              documentsRetrieved: response.documents.length,
              searchStrategy: response.searchStrategy,
              processingTime: response.processingTime
            });

            return {
              documents: response.documents.length,
              advancedResults: response.advancedResults?.length || 0,
              context: response.context,
              analysis: response.analysis,
              searchStrategy: response.searchStrategy,
              expandedQueries: response.analysis.entities?.length || 0,
              metrics: response.metrics,
              documentLinks: response.documentLinks,
              metricsText: response.metricsText,
              documentLinksText: response.documentLinksText,
              processingTime: response.processingTime,
              toolsUsed: response.toolsUsed,
              cacheHit: response.cacheHit,
              performanceMetrics: response.performanceMetrics,
              contextWindow: searchType === 'advanced_rag' ? contextWindow : undefined
            };
          } catch (error) {
            // Log tool call error
            logger.error(LogCategory.API, `Tool call error: ${toolId}`, error, {
              toolId,
              toolName: 'searchDocuments',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            return { error: 'Failed to search documents' };
          }
        },
      },

     

      // Query refinement
      refineQuery: {
        description: 'Refine the search query based on initial results to improve retrieval',
        inputSchema: z.object({
          originalQuery: z.string().describe('The original search query'),
          feedback: z.string().describe('Feedback about the search results'),
        }),
        execute: async ({ originalQuery, feedback }: { originalQuery: string; feedback: string }) => {
          try {
            // Use RAG orchestrator to refine the query
            const orchestrator = await getOrchestrator();
            const response = await orchestrator.processQuery({
              query: originalQuery,
              searchType: 'hybrid',
              limit: 5,
              useCache: false,
              trackPerformance: true
            });

            // Generate refined query based on feedback and processing
            const refinedQuery = `Refined query based on feedback: ${originalQuery} [${feedback}] - Enhanced with: ${response.analysis.entities?.slice(0, 2).join(', ') || 'processing'}`;
            
            return { 
              refinedQuery, 
              originalQuery, 
              feedback,
              processingAnalysis: response.analysis,
              expandedQueries: response.analysis.entities || [],
              processingTime: response.processingTime,
              toolsUsed: response.toolsUsed
            };
          } catch (error) {
            console.error('Query refinement error:', error);
            return { 
              refinedQuery: `Refined query based on feedback: ${originalQuery} [${feedback}]`,
              originalQuery, 
              feedback,
              error: 'Failed to refine query'
            };
          }
        },
      },

      // Performance monitoring tool
      getPerformanceMetrics: {
        description: 'Get performance metrics and system statistics',
        inputSchema: z.object({
          exportData: z.boolean().optional().describe('Whether to export detailed metrics data'),
        }),
        execute: async ({ exportData = false }: { exportData?: boolean }) => {
          try {
            const orchestrator = await getOrchestrator();
            const performanceSummary = orchestrator.getPerformanceSummary();
            const cacheStats = orchestrator.getCacheStats();
            const availableStrategies = orchestrator.getAvailableStrategies();

            const result: any = {
              performanceSummary,
              cacheStats,
              availableStrategies,
              systemStatus: 'operational'
            };

            if (exportData) {
              result.performanceMetrics = orchestrator.exportPerformanceMetrics();
              result.cacheData = orchestrator.exportCacheData();
            }

            return result;
          } catch (error) {
            console.error('Performance metrics error:', error);
            return { error: 'Failed to get performance metrics' };
          }
        },
      },
    },
  });

  // Log API request end
  const endTime = Date.now();
  const totalResponseTime = endTime - startTime;
  logger.info(LogCategory.API, `API request end: ${requestId}`, {
    requestId,
    totalResponseTime,
    status: 'success'
  });

  // Log LLM response
  logger.logLLM({
    timestamp: new Date().toISOString(),
    level: 'AUDIT' as any,
    category: LogCategory.LLM,
    message: `LLM response for request: ${requestId}`,
    model: 'gemini-2.0-flash',
    prompt: (messages[messages.length - 1] as any)?.content || '',
    response: 'Streaming response',
    tokens: 0, // Will be calculated when response is complete
    cost: 0, // Will be calculated when response is complete
    latency: totalResponseTime
  });

  return result.toUIMessageStreamResponse({
    // onError: errorHandler,
  });
}

// export function errorHandler(error: unknown) {
//   if (error == null) {
//     return 'unknown error';
//   }

//   if (typeof error === 'string') {
//     return error;
//   }

//   if (error instanceof Error) {
//     return error.message;
//   }

//   return JSON.stringify(error);
// }