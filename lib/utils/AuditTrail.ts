import { logger, LogCategory } from '../logging/Logger';

export interface AuditSession {
  sessionId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  queries: QueryAudit[];
}

export interface QueryAudit {
  queryId: string;
  query: string;
  timestamp: Date;
  response?: string;
  toolCalls: ToolCallAudit[];
  metrics: QueryMetrics;
  sessionId: string;
}

export interface ToolCallAudit {
  toolId: string;
  toolName: string;
  input: any;
  output: any;
  duration: number;
  timestamp: Date;
  sessionId: string;
}

export interface QueryMetrics {
  totalTime: number;
  documentsRetrieved: number;
  searchStrategy: string;
  embeddingTime: number;
  retrievalTime: number;
}

export class AuditTrailManager {
  private sessions: Map<string, AuditSession> = new Map();
  private currentSessionId: string | null = null;

  startSession(userId: string): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session: AuditSession = {
      sessionId,
      userId,
      startTime: new Date(),
      queries: []
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;

    logger.audit(LogCategory.AUDIT, `Session started: ${sessionId}`, {
      userId,
      sessionId
    });

    return sessionId;
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = new Date();
      
      logger.audit(LogCategory.AUDIT, `Session ended: ${sessionId}`, {
        sessionId,
        duration: session.endTime.getTime() - session.startTime.getTime(),
        queriesCount: session.queries.length
      });
    }

    if (this.currentSessionId === sessionId) {
      this.currentSessionId = null;
    }
  }

  logQueryStart(query: string, sessionId?: string): string {
    const activeSessionId = sessionId || this.currentSessionId;
    if (!activeSessionId) {
      throw new Error('No active session');
    }

    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queryAudit: QueryAudit = {
      queryId,
      query,
      timestamp: new Date(),
      toolCalls: [],
      metrics: {
        totalTime: 0,
        documentsRetrieved: 0,
        searchStrategy: 'unknown',
        embeddingTime: 0,
        retrievalTime: 0
      },
      sessionId: activeSessionId
    };

    const session = this.sessions.get(activeSessionId);
    if (session) {
      session.queries.push(queryAudit);
    }

    logger.audit(LogCategory.AUDIT, `Query started: ${query}`, {
      queryId,
      sessionId: activeSessionId,
      query
    });

    return queryId;
  }

  logQueryEnd(queryId: string, response: string, metrics: QueryMetrics): void {
    for (const session of this.sessions.values()) {
      const query = session.queries.find(q => q.queryId === queryId);
      if (query) {
        query.response = response;
        query.metrics = metrics;
        
        logger.audit(LogCategory.AUDIT, `Query completed: ${queryId}`, {
          queryId,
          sessionId: session.sessionId,
          metrics
        });
        break;
      }
    }
  }

  logToolCall(
    toolName: string,
    input: any,
    output: any,
    duration: number,
    sessionId?: string
  ): string {
    const activeSessionId = sessionId || this.currentSessionId;
    if (!activeSessionId) {
      throw new Error('No active session');
    }

    const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const toolCallAudit: ToolCallAudit = {
      toolId,
      toolName,
      input,
      output,
      duration,
      timestamp: new Date(),
      sessionId: activeSessionId
    };

    // Find the most recent query in the session and add the tool call
    const session = this.sessions.get(activeSessionId);
    if (session && session.queries.length > 0) {
      const lastQuery = session.queries[session.queries.length - 1];
      lastQuery.toolCalls.push(toolCallAudit);
    }

    logger.audit(LogCategory.AUDIT, `Tool call logged: ${toolName}`, {
      toolId,
      toolName,
      sessionId: activeSessionId,
      duration
    });

    return toolId;
  }

  getSession(sessionId: string): AuditSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AuditSession[] {
    return Array.from(this.sessions.values());
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  clearSessions(): void {
    this.sessions.clear();
    this.currentSessionId = null;
    
    logger.audit(LogCategory.AUDIT, 'All audit sessions cleared');
  }

  exportAuditTrail(): {
    sessions: AuditSession[];
    exportTimestamp: string;
    totalSessions: number;
    totalQueries: number;
  } {
    const sessions = this.getAllSessions();
    const totalQueries = sessions.reduce((sum, session) => sum + session.queries.length, 0);

    return {
      sessions,
      exportTimestamp: new Date().toISOString(),
      totalSessions: sessions.length,
      totalQueries
    };
  }

  getSessionStats(sessionId: string): {
    sessionDuration: number;
    totalQueries: number;
    averageQueryTime: number;
    totalToolCalls: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    const sessionDuration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();

    const totalQueries = session.queries.length;
    const averageQueryTime = totalQueries > 0 
      ? session.queries.reduce((sum, q) => sum + q.metrics.totalTime, 0) / totalQueries
      : 0;

    const totalToolCalls = session.queries.reduce((sum, q) => sum + q.toolCalls.length, 0);

    return {
      sessionDuration,
      totalQueries,
      averageQueryTime,
      totalToolCalls
    };
  }
}
