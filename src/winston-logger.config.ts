import * as winston from 'winston';
import 'winston-daily-rotate-file';
import dayjs from 'dayjs';

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/application-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20k',
  maxFiles: '14d',
});

const customFormat = winston.format.printf(({ level, message }) => {
  return `${dayjs().format('YYYY-MM-DD HH:mm:ss')} [${level.toUpperCase()}]: ${message}  `;
});

export const winstonConfig: winston.LoggerOptions = {
  format: winston.format.combine(
    winston.format.timestamp({ format: () => new Date().toISOString() }), // ISO UTC timestamp
    customFormat,
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
    transport,
  ],
};
