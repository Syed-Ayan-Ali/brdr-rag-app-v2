import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, generateText, UIMessage, stepCountIs, InvalidToolInputError, NoSuchToolError, tool, ToolSet, InferUITools, UIDataTypes } from 'ai';
import { z } from 'zod';
// import { RAGOrchestratorFactory } from '@/lib/RAGOrchestrator';
import { logger, LogCategory } from '../../../lib/logging/Logger';
import { findRelevantContent } from '@/lib/actions/findRelevantContent';
import { getDateAndTimeFromQuery } from '@/lib/actions/getDateAndTimeFromQuery';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Model to use
const model = 'gemini-2.0-flash';
// Initialize RAG orchestrator
// let ragOrchestrator: any = null;

// Initialize the orchestrator
// async function getOrchestrator() {
//   if (!ragOrchestrator) {
//     ragOrchestrator = await RAGOrchestratorFactory.createDefaultOrchestrator();
//   }
//   return ragOrchestrator;
// }


export type ChatTools = InferUITools<typeof tools>;

export type ChatMessage = UIMessage<never, UIDataTypes, ChatTools>;


const tools = {
  // get_date_time_from_query: tool({
  //   description: "get the date and time from the users question",
  //   inputSchema: z.object({
  //     question: z.string().describe('the users question'),
  //     limit: z.number().optional().default(1).describe('the number of chunks to return'),
  //   }),
  //   execute: async ({ question, limit }) => {
  //     const result = await getDateAndTimeFromQuery(question, limit);
  //     console.log("result from get_date_time_from_query is", result);
  //     return `The date and time from the users question is ${result}`;
  //   },
  // }),

  find_relevant_brdr_document_data: tool({
    description: "Get the chunks relevant to the users question",
    inputSchema: z.object({
      question: z.string().describe('the users query to find the relevant chunks'),
      limit: z.number().optional().default(1).describe('the number of chunks to return'),
    }),
    execute: async ({ question, limit }) => {
      const result = await findRelevantContent(question, limit);
      console.log("result from find_relevant_brdr_document_data is", result);
      // Check if the result is an error object
      return result;
    },
  }),

  // tell_the_user_the_answer: tool({
  //   description: `
  //   If the result is null, then say nothing. End the conversation.
  //   Pass the chunks to the llm alongside the user question to generate a comprehensive answer in natural language and using the markdown format. If you receive an error from find_relevant_brdr_document_data, inform the user about the error and ask them to try again.
  //   `
  //   ,
  //   inputSchema: z.object({
  //     answer: z.string().describe('the answer to the users question'),
  //   }),
  //   execute: async ({ answer }) => answer,
  // }),
} satisfies ToolSet;
export async function POST(req: Request) {
  // const { messages }: { messages: ChatMessage[] } = await req.json();
  
  const { messages }: { messages: UIMessage[] } = await req.json();
  // const messages = await req.json();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  // console.log("message is", messages[messages.length - 1].parts[0].text);
  // const result =  streamText({
  //   model: google(model),
  //   maxOutputTokens: 512,
  //   tools: {
  //     weather: tool({
  //       description: 'Get the weather in a location',
  //       inputSchema: z.object({
  //         location: z.string().describe('The location to get the weather for'),
  //       }),
  //       // execute: async ({ location }) => ({
  //       //   location,
  //       //   temperature: 72 + Math.floor(Math.random() * 21) - 10,
  //       // }),
  //     }),
  //     cityAttractions: tool({
  //       inputSchema: z.object({ city: z.string() }),
  //     }),
  //   },
  //   prompt:
  //     'Act like a clown and asnwer this: What is the weather in Hong Kong?',
  // });



  // console.log(JSON.stringify(result, null, 2));

  const result = streamText({
    model: google(model),
    providerOptions: {
      google: {
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_LOW_AND_ABOVE',
          },
        ],
        // thinkingConfig: {
        //   thinkingBudget: 8192,
        //   includeThoughts: true,
        // },
      },
    },
    messages: convertToModelMessages(messages),
    // system: `
    // You are an expert AI assistant and you help user answer queries by running the tools provided to you.
    //         The tools available to you are **get_date_time_from_query** to get the date and time from the users question. 
    //         and the tool **find_relevant_brdr_document_data** to find the relevant chunks from the brdr_documents_data using semantic similarity. 
    //         `,
    tools,
    stopWhen: stepCountIs(2),
    toolChoice: 'required',
  });

  // for (const toolResult of await result.toolResults) {
  //   if (toolResult.dynamic) {
  //     continue;
  //   }

  //   switch (toolResult.toolName) {
  //     case 'find_relevant_brdr_document_data': {
  //       toolResult.output[0].content; // string
  //       toolResult.output[0].similarity; // number
  //       toolResult.output[0].docId; // string
  //       toolResult.output[0].metadata; // any
  //       break;
  //     }
  //   }
  // }

  // console.log(JSON.stringify(result, null, 2));
  
  // for await (const textPart of result.textStream) {
  //   process.stdout.write(textPart);
  // } 

  // // Add system message with instructions for metrics and document links
  // const systemMessage = {
  //   role: 'assistant' as const,
  //   content: `
  //   ROLE:
  //   You are an expert AI assistant and you help user answer queries by analyzing the BRDR database and finding relevant documents.
    
  //   YOUR PROCESS:
  //   - **FIRST**: The user will ask you a question
  //   - **THEN**: You will need to search for relevant documents in the BRDR knowledge base to answer the question using the tool find_relevant_brdr_document_data.
  //   - **FINALLY**: generate an answer using the array of chunks that are returned by the tool. 
      
  //   If the chunks are an empty array, then say "I could not find the answer in the knowledge base".  
  //   Otherwise, answer in natural language the user query using the chunks that you have found in the knowledge base and format the answer in markdown.
  //   `,
    
  // };

  // // Log API request start
  // logger.info(LogCategory.API, `API request start: ${requestId}`, {
  //   requestId,
  //   messagesCount: messages.length,
  //   timestamp: new Date().toISOString()
  // });


  // const result = streamText({
  //   model: google(model),
  //   messages: convertToModelMessages(messages),
  //   // prompt: 'You are a helpful AI assistant for BRDR (Banking Returns Data Repository) documents. The user will ask you a question and you will need to search for relevant documents in the BRDR knowledge base to answer the question using the tool getInformation. if the result is an empty array, show the result and then respond with "Sorry, either the similarity threshold is too high or the information does not exist in the knowledge base."  If the result is not an empty array, answer in natural language the user query using the chunks that you have found in the knowledge base and format the answer in markdown',
  //   system: systemMessage.content,
  //   tools: {
  //     find_relevant_brdr_document_data: {
  //       description: "Get the relevant chunks from the brdr_documents_data using semantic similarity",
  //       inputSchema: z.object({
  //         question: z.string().describe('the users query to find the relevant chunks'),
  //         // similarity_threshold: z.number().describe('the similarity threshold to use for the semantic similarity'),
  //         limit: z.number().optional().default(5).describe('the number of chunks to return'),
  //       }),
  //       execute: async ({ question, limit }) => findRelevantContent(question, limit),
  //       // execute: async ({ location }) => ({
  //       //   location,
  //       //   temperature: 72 + Math.floor(Math.random() * 21) - 10,
  //       // }),
  //     },
  //   },
  //   toolChoice: 'required',
  //   // tools: {
  //   //   // // Enhanced document search with multiple strategies
  //   //   // searchDocuments: {
  //   //   //   description: 'Search for relevant documents in the BRDR database using advanced search strategies',
  //   //   //   inputSchema: z.object({
  //   //   //     query: z.string().describe('The search query'),
  //   //   //     searchType: z.literal('keyword').optional().describe('Search strategy to use'),
  //   //   //     limit: z.number().optional().describe('Number of original chunks to retrieve (default: 3 for advanced_rag, 5 for others)'),
  //   //   //     contextWindow: z.number().optional().describe('Number of surrounding chunks to include (±2 default for advanced_rag)'),
  //   //   //   }),
  //   //   //   execute: async ({ query, searchType = 'keyword', limit, contextWindow = 2 }: { query: string; searchType?: string; limit?: number; contextWindow?: number }) => {
  //   //   //     // Set appropriate defaults based on search type
  //   //   //     const defaultLimit = searchType === 'advanced_rag' ? 3 : 5;
  //   //   //     const finalLimit = limit || defaultLimit;
  //   //   //     const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
  //   //   //     try {
  //   //   //       // Log tool call start
  //   //   //       logger.info(LogCategory.API, `Tool call start: ${toolId} - searchDocuments`, {
  //   //   //         toolId,
  //   //   //         toolName: 'searchDocuments',
  //   //   //         input: { query, searchType, limit: finalLimit, contextWindow }
  //   //   //       });
            
  //   //   //       // Use RAG orchestrator to process the query
  //   //   //       const orchestrator = await getOrchestrator();
  //   //   //       const response = await orchestrator.processQuery({
  //   //   //         query,
  //   //   //         searchType: searchType as 'keyword',
  //   //   //         limit: finalLimit,
  //   //   //         contextWindow,
  //   //   //         useCache: true,
  //   //   //         trackPerformance: true
  //   //   //       });

  //   //   //       // Log tool call success
  //   //   //       logger.info(LogCategory.API, `Tool call success: ${toolId}`, {
  //   //   //         toolId,
  //   //   //         auditSessionId: response.auditSessionId,
  //   //   //         documentsRetrieved: response.documents.length,
  //   //   //         searchStrategy: response.searchStrategy,
  //   //   //         processingTime: response.processingTime
  //   //   //       });

  //   //   //       return {
  //   //   //         documents: response.documents.length,
  //   //   //         advancedResults: response.advancedResults?.length || 0,
  //   //   //         context: response.context,
  //   //   //         analysis: response.analysis,
  //   //   //         searchStrategy: response.searchStrategy,
  //   //   //         expandedQueries: response.analysis.entities?.length || 0,
  //   //   //         metrics: response.metrics,
  //   //   //         documentLinks: response.documentLinks,
  //   //   //         metricsText: response.metricsText,
  //   //   //         documentLinksText: response.documentLinksText,
  //   //   //         processingTime: response.processingTime,
  //   //   //         toolsUsed: response.toolsUsed,
  //   //   //         cacheHit: response.cacheHit,
  //   //   //         performanceMetrics: response.performanceMetrics,
  //   //   //         contextWindow: searchType === 'advanced_rag' ? contextWindow : undefined
  //   //   //       };
  //   //   //     } catch (error) {
  //   //   //       // Log tool call error
  //   //   //       logger.error(LogCategory.API, `Tool call error: ${toolId}`, error, {
  //   //   //         toolId,
  //   //   //         toolName: 'searchDocuments',
  //   //   //         error: error instanceof Error ? error.message : 'Unknown error'
  //   //   //       });
  //   //   //       return { error: 'Failed to search documents' };
  //   //   //     }
  //   //   //   },
  //   //   // },

     

  //   //   // // Query refinement
  //   //   // refineQuery: {
  //   //   //   description: 'Refine the search query based on initial results to improve retrieval',
  //   //   //   inputSchema: z.object({
  //   //   //     originalQuery: z.string().describe('The original search query'),
  //   //   //     feedback: z.string().describe('Feedback about the search results'),
  //   //   //   }),
  //   //   //   execute: async ({ originalQuery, feedback }: { originalQuery: string; feedback: string }) => {
  //   //   //     try {
  //   //   //       // Use RAG orchestrator to refine the query
  //   //   //       const orchestrator = await getOrchestrator();
  //   //   //       const response = await orchestrator.processQuery({
  //   //   //         query: originalQuery,
  //   //   //         searchType: 'hybrid',
  //   //   //         limit: 5,
  //   //   //         useCache: false,
  //   //   //         trackPerformance: true
  //   //   //       });

  //   //   //       // Generate refined query based on feedback and processing
  //   //   //       const refinedQuery = `Refined query based on feedback: ${originalQuery} [${feedback}] - Enhanced with: ${response.analysis.entities?.slice(0, 2).join(', ') || 'processing'}`;
            
  //   //   //       return { 
  //   //   //         refinedQuery, 
  //   //   //         originalQuery, 
  //   //   //         feedback,
  //   //   //         processingAnalysis: response.analysis,
  //   //   //         expandedQueries: response.analysis.entities || [],
  //   //   //         processingTime: response.processingTime,
  //   //   //         toolsUsed: response.toolsUsed
  //   //   //       };
  //   //   //     } catch (error) {
  //   //   //       console.error('Query refinement error:', error);
  //   //   //       return { 
  //   //   //         refinedQuery: `Refined query based on feedback: ${originalQuery} [${feedback}]`,
  //   //   //         originalQuery, 
  //   //   //         feedback,
  //   //   //         error: 'Failed to refine query'
  //   //   //       };
  //   //   //     }
  //   //   //   },
  //   //   // },

  //   //   // // Performance monitoring tool
  //   //   // getPerformanceMetrics: {
  //   //   //   description: 'Get performance metrics and system statistics',
  //   //   //   inputSchema: z.object({
  //   //   //     exportData: z.boolean().optional().describe('Whether to export detailed metrics data'),
  //   //   //   }),
  //   //   //   execute: async ({ exportData = false }: { exportData?: boolean }) => {
  //   //   //     try {
  //   //   //       const orchestrator = await getOrchestrator();
  //   //   //       const performanceSummary = orchestrator.getPerformanceSummary();
  //   //   //       const cacheStats = orchestrator.getCacheStats();
  //   //   //       const availableStrategies = orchestrator.getAvailableStrategies();

  //   //   //       const result: any = {
  //   //   //         performanceSummary,
  //   //   //         cacheStats,
  //   //   //         availableStrategies,
  //   //   //         systemStatus: 'operational'
  //   //   //       };

  //   //   //       if (exportData) {
  //   //   //         result.performanceMetrics = orchestrator.exportPerformanceMetrics();
  //   //   //         result.cacheData = orchestrator.exportCacheData();
  //   //   //       }

  //   //   //       return result;
  //   //   //     } catch (error) {
  //   //   //       console.error('Performance metrics error:', error);
  //   //   //       return { error: 'Failed to get performance metrics' };
  //   //   //     }
  //   //   //   },
  //   //   // },
  //   // },
  // });

  // for await (const textPart of result.textStream) {
  //   process.stdout.write(textPart);
  // }

  console.log("result.warnings are", result.warnings);
  console.log("result is", result.textStream);

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
    model: model,
    prompt: (messages[messages.length - 1] as any)?.content || '',
    response: 'Streaming response',
    tokens: 0, // Will be calculated when response is complete
    cost: 0, // Will be calculated when response is complete
    latency: totalResponseTime
  });

  return result.toUIMessageStreamResponse();
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