import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

// In production, we log to a rolling file and optionally to stdout.
// In development, we use pino-pretty for colorized terminal output.

const transports = isProduction
  ? pino.transport({
      targets: [
        {
          target: 'pino-roll',
          options: {
            file: 'logs/app',
            frequency: 'daily',
            mkdir: true,
            size: '10m', // Rotate when file size exceeds 10MB
            extension: '.log',
          },
          level: 'info',
        },
        {
          target: 'pino/file',
          options: { destination: 1 }, // stdout
          level: 'info',
        },
      ],
    })
  : pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    });

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transports
);
