import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLogger, transports, format } from 'winston';

//  __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create logger
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.File({ filename: path.join(logDir, 'apiLogger.log') }),
    new transports.File({
      filename: path.join(logDir, 'errorLogger.log'),
      level: 'error'
    })
  ]
});

export default logger;
