import { Context, APIGatewayEvent } from 'aws-lambda';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private serviceName: string;
  private logLevel: LogLevel;

  constructor(serviceName: string = 'stealth-aaas', logLevel: LogLevel = 'INFO') {
    this.serviceName = serviceName;
    this.logLevel = logLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.serviceName,
      ...context,
    };
    return JSON.stringify(entry);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatLog('DEBUG', message, context));
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('INFO')) {
      console.log(this.formatLog('INFO', message, context));
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatLog('WARN', message, context));
    }
  }

  error(
    message: string,
    error?: Error,
    context?: Record<string, unknown>
  ): void {
    if (this.shouldLog('ERROR')) {
      const errorContext = error
        ? {
            errorName: error.name,
            errorMessage: error.message,
            stackTrace: error.stack,
          }
        : {};
      console.error(
        this.formatLog('ERROR', message, { ...context, ...errorContext })
      );
    }
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

export function getLogger(serviceName?: string): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(
      serviceName || 'stealth-aaas',
      (process.env.LOG_LEVEL as LogLevel) || 'INFO'
    );
  }
  return loggerInstance;
}

/**
 * Create a logger with a specific service name
 */
export function createLogger(serviceName: string): Logger {
  return new Logger(serviceName, (process.env.LOG_LEVEL as LogLevel) || 'INFO');
}

/**
 * Log API request details
 */
export function logRequest(
  event: APIGatewayEvent,
  context: Context
): void {
  const logger = getLogger();
  logger.info('Incoming request', {
    requestId: context.requestId,
    path: event.path,
    method: event.httpMethod,
    sourceIp: event.requestContext?.identity?.sourceIp,
    userAgent: event.requestContext?.identity?.userAgent,
  });
}

/**
 * Log API response details
 */
export function logResponse(statusCode: number, requestId: string): void {
  const logger = getLogger();
  logger.info('Outgoing response', {
    statusCode,
    requestId,
  });
}

/**
 * Log error with context
 */
export function logError(
  error: Error,
  context: Context,
  additionalInfo?: Record<string, unknown>
): void {
  const logger = getLogger();
  logger.error('Error occurred', error, {
    requestId: context.requestId,
    ...additionalInfo,
  });
}

export default getLogger;
