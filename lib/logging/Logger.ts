export enum LogCategory {
  CRAWLER = 'CRAWLER',
  ETL = 'ETL',
  EMBEDDING = 'EMBEDDING',
  CHUNKING = 'CHUNKING',
  RAG = 'RAG',
  API = 'API',
  LLM = 'LLM',
  DATABASE = 'DATABASE',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
  AUDIT = 'AUDIT'
}

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  AUDIT = 'AUDIT'
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  sessionId?: string;
  requestId?: string;
  error?: any;
}

export interface CrawlLogEntry extends LogEntry {
  docId?: string;
  source?: string;
  status?: 'success' | 'error' | 'skipped';
  contentLength?: number;
  processingTime?: number;
}

export interface APILogEntry extends LogEntry {
  requestId: string;
  method?: string;
  path?: string;
  statusCode?: number;
  responseTime?: number;
  userAgent?: string;
}

export interface LLMLogEntry extends LogEntry {
  model: string;
  prompt: string;
  response: string;
  tokens: number;
  cost: number;
  latency: number;
}

export interface LogOptions {
  startDate?: string;
  endDate?: string;
  category?: LogCategory;
  level?: LogLevel;
  limit?: number;
  sessionId?: string;
  requestId?: string;
}

export class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private crawlLogs: CrawlLogEntry[] = [];
  private apiLogs: APILogEntry[] = [];
  private llmLogs: LLMLogEntry[] = [];
  private maxLogs: number = 10000;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private createBaseLog(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    sessionId?: string,
    requestId?: string
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
      sessionId,
      requestId
    };
  }

  debug(category: LogCategory, message: string, data?: any, sessionId?: string): void {
    const log = this.createBaseLog(LogLevel.DEBUG, category, message, data, sessionId);
    this.addLog(log);
    console.debug(`[${category}] ${message}`, data || '');
  }

  info(category: LogCategory, message: string, data?: any, sessionId?: string): void {
    const log = this.createBaseLog(LogLevel.INFO, category, message, data, sessionId);
    this.addLog(log);
    console.info(`[${category}] ${message}`, data || '');
  }

  warn(category: LogCategory, message: string, data?: any, sessionId?: string): void {
    const log = this.createBaseLog(LogLevel.WARN, category, message, data, sessionId);
    this.addLog(log);
    console.warn(`[${category}] ${message}`, data || '');
  }

  error(category: LogCategory, message: string, error?: any, data?: any, sessionId?: string): void {
    const log = this.createBaseLog(LogLevel.ERROR, category, message, { ...data, error }, sessionId);
    this.addLog(log);
    console.error(`[${category}] ${message}`, error, data || '');
  }

  audit(category: LogCategory, message: string, data?: any, sessionId?: string): void {
    const log = this.createBaseLog(LogLevel.AUDIT, category, message, data, sessionId);
    this.addLog(log);
    console.log(`[AUDIT][${category}] ${message}`, data || '');
  }

  logCrawl(crawlLog: Partial<CrawlLogEntry>): void {
    const log: CrawlLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.AUDIT,
      category: LogCategory.CRAWLER,
      message: crawlLog.message || 'Crawl operation',
      ...crawlLog
    };
    
    this.crawlLogs.push(log);
    this.trimLogs(this.crawlLogs);
    console.log(`[CRAWL] ${log.message}`, {
      docId: log.docId,
      status: log.status,
      contentLength: log.contentLength
    });
  }

  logAPI(apiLog: Partial<APILogEntry>): void {
    const log: APILogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: LogCategory.API,
      message: apiLog.message || 'API request',
      requestId: apiLog.requestId || `req_${Date.now()}`,
      ...apiLog
    };
    
    this.apiLogs.push(log);
    this.trimLogs(this.apiLogs);
    console.log(`[API] ${log.message}`, {
      requestId: log.requestId,
      method: log.method,
      statusCode: log.statusCode,
      responseTime: log.responseTime
    });
  }

  logLLM(llmLog: Partial<LLMLogEntry>): void {
    const log: LLMLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.AUDIT,
      category: LogCategory.LLM,
      message: llmLog.message || 'LLM interaction',
      model: llmLog.model || 'unknown',
      prompt: llmLog.prompt || '',
      response: llmLog.response || '',
      tokens: llmLog.tokens || 0,
      cost: llmLog.cost || 0,
      latency: llmLog.latency || 0,
      ...llmLog
    };
    
    this.llmLogs.push(log);
    this.trimLogs(this.llmLogs);
    console.log(`[LLM] ${log.message}`, {
      model: log.model,
      tokens: log.tokens,
      cost: log.cost,
      latency: log.latency
    });
  }

  private addLog(log: LogEntry): void {
    this.logs.push(log);
    this.trimLogs(this.logs);
  }

  private trimLogs(logArray: any[]): void {
    if (logArray.length > this.maxLogs) {
      logArray.splice(0, logArray.length - this.maxLogs);
    }
  }

  async getAuditTrail(options: LogOptions = {}): Promise<LogEntry[]> {
    return this.filterLogs(this.logs, options);
  }

  async getCrawlLogs(options: LogOptions = {}): Promise<CrawlLogEntry[]> {
    return this.filterLogs(this.crawlLogs, options) as CrawlLogEntry[];
  }

  async getAPILogs(options: LogOptions = {}): Promise<APILogEntry[]> {
    return this.filterLogs(this.apiLogs, options) as APILogEntry[];
  }

  async getLLMLogs(options: LogOptions = {}): Promise<LLMLogEntry[]> {
    return this.filterLogs(this.llmLogs, options) as LLMLogEntry[];
  }

  private filterLogs<T extends LogEntry>(logs: T[], options: LogOptions): T[] {
    let filtered = logs;

    // Filter by date range
    if (options.startDate) {
      filtered = filtered.filter(log => log.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      filtered = filtered.filter(log => log.timestamp <= options.endDate!);
    }

    // Filter by category
    if (options.category) {
      filtered = filtered.filter(log => log.category === options.category);
    }

    // Filter by level
    if (options.level) {
      filtered = filtered.filter(log => log.level === options.level);
    }

    // Filter by sessionId
    if (options.sessionId) {
      filtered = filtered.filter(log => log.sessionId === options.sessionId);
    }

    // Filter by requestId
    if (options.requestId) {
      filtered = filtered.filter(log => log.requestId === options.requestId);
    }

    // Apply limit
    if (options.limit) {
      filtered = filtered.slice(-options.limit);
    }

    return filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  clearLogs(): void {
    this.logs = [];
    this.crawlLogs = [];
    this.apiLogs = [];
    this.llmLogs = [];
    console.log('All logs cleared');
  }

  getLogCounts(): {
    total: number;
    crawl: number;
    api: number;
    llm: number;
  } {
    return {
      total: this.logs.length,
      crawl: this.crawlLogs.length,
      api: this.apiLogs.length,
      llm: this.llmLogs.length
    };
  }

  exportLogs(): {
    logs: LogEntry[];
    crawlLogs: CrawlLogEntry[];
    apiLogs: APILogEntry[];
    llmLogs: LLMLogEntry[];
    exportTimestamp: string;
  } {
    return {
      logs: this.logs,
      crawlLogs: this.crawlLogs,
      apiLogs: this.apiLogs,
      llmLogs: this.llmLogs,
      exportTimestamp: new Date().toISOString()
    };
  }

  setMaxLogs(maxLogs: number): void {
    this.maxLogs = maxLogs;
    this.trimLogs(this.logs);
    this.trimLogs(this.crawlLogs);
    this.trimLogs(this.apiLogs);
    this.trimLogs(this.llmLogs);
  }
}

// Export singleton instance
export const logger = Logger.getInstance();
