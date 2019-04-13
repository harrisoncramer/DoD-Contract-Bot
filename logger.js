const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const path = require('path');

const env = process.env.NODE_ENV || 'development';
const logDir = 'log';

// Create the log directory if it does not exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const filename = path.join(logDir, 'results.log');

const logger = createLogger({
  // change level if in dev environment versus production
  level: env === 'debug',
  format: format.combine(
    format.timestamp({
      format: 'MM-DD-YYYY HH:mm:ss'
    }),
    format.printf(info => `${info.level} @ ${info.timestamp} –– ${info.message}`)
  ),
  transports: [
    new transports.Console({
      level: 'debug',
      format: format.combine(
        format.colorize(),
        format.printf(
          info => `${info.level} @ ${info.timestamp} –– ${info.message}`
        )
      )
    }),
    new transports.File({ filename })
  ]
});

module.exports = logger;