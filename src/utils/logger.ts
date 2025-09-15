import chalk from 'chalk';
import dayjs from 'dayjs';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SUCCESS = 4
}

export class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = dayjs().format('YYYY-MM-DD HH:mm:ss');
    return `[${timestamp}] [${level}] ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(chalk.gray(this.formatMessage('DEBUG', message)), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.blue(this.formatMessage('INFO', message)), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow(this.formatMessage('WARN', message)), ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(chalk.red(this.formatMessage('ERROR', message)), ...args);
      if (error) {
        console.error(chalk.red(error.stack || error.message));
      }
    }
  }

  success(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.SUCCESS)) {
      console.log(chalk.green(this.formatMessage('SUCCESS', message)), ...args);
    }
  }

  progress(current: number, total: number, label: string = ''): void {
    const percentage = Math.round((current / total) * 100);
    const filled = Math.round(percentage / 2);
    const empty = 50 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    process.stdout.write(
      `\r${label} ${chalk.cyan(bar)} ${chalk.bold(`${percentage}%`)} (${current}/${total})`
    );
    
    if (current === total) {
      process.stdout.write('\n');
    }
  }

  table(data: Record<string, any>[]): void {
    if (data.length === 0) return;
    
    console.table(data);
  }

  divider(char: string = '=', length: number = 50): void {
    console.log(chalk.gray(char.repeat(length)));
  }
}

export const logger = Logger.getInstance(); 