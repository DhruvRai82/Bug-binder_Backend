/**
 * Logger Utility
 * 
 * Purpose: Replace console.log with environment-aware logging
 * Benefits:
 * - Production-safe (no debug logs in production)
 * - Consistent log format
 * - Easy to extend (can add file logging, external services later)
 * - Type-safe
 * 
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.debug('Debug message', { data: 'value' });
 *   logger.info('Info message');
 *   logger.warn('Warning message', error, { context: 'value' });
 *   logger.error('Error message', error, { context: 'value' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMeta = Record<string, unknown>;

class Logger {
    private isDevelopment = process.env.NODE_ENV === 'development';

    /**
     * Debug logs - only shown in development
     * Use for: Detailed debugging information
     */
    debug(message: string, meta?: LogMeta): void {
        if (this.isDevelopment) {
            console.log(`[DEBUG] ${message}`, meta || '');
        }
    }

    /**
     * Info logs - shown in all environments
     * Use for: General information, successful operations
     */
    info(message: string, meta?: LogMeta): void {
        console.log(`[INFO] ${message}`, meta || '');
    }

    /**
     * Warning logs - shown in all environments
     * Use for: Potential issues, deprecated features
     * 
     * @param message - Warning message
     * @param error - Optional error object
     * @param meta - Optional metadata
     */
    warn(message: string, error?: Error | unknown, meta?: LogMeta): void {
        if (error instanceof Error) {
            console.warn(`[WARN] ${message}`, {
                message: error.message,
                stack: error.stack,
                ...meta
            });
        } else if (error) {
            console.warn(`[WARN] ${message}`, error, meta || '');
        } else {
            console.warn(`[WARN] ${message}`, meta || '');
        }
    }

    /**
     * Error logs - shown in all environments
     * Use for: Errors, exceptions, failures
     * 
     * @param message - Error message
     * @param error - Optional error object
     * @param meta - Optional metadata
     */
    error(message: string, error?: Error | unknown, meta?: LogMeta): void {
        if (error instanceof Error) {
            console.error(`[ERROR] ${message}`, {
                message: error.message,
                stack: error.stack,
                ...meta
            });
        } else if (error) {
            console.error(`[ERROR] ${message}`, error, meta || '');
        } else {
            console.error(`[ERROR] ${message}`, meta || '');
        }
    }

    /**
     * Log with custom level
     */
    log(level: LogLevel, message: string, meta?: LogMeta): void {
        switch (level) {
            case 'debug':
                this.debug(message, meta);
                break;
            case 'info':
                this.info(message, meta);
                break;
            case 'warn':
                this.warn(message, undefined, meta);
                break;
            case 'error':
                this.error(message, undefined, meta);
                break;
        }
    }
}

export const logger = new Logger();
