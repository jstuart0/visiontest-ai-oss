// VisionTest AI - Worker Logger

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  name: 'visiontest-worker',
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
});
