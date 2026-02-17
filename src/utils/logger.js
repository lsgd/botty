// Structured logger for OpenObserve compatibility
// Outputs JSON by default, or human-readable format with LOG_FORMAT=pretty

const LOG_FORMAT = process.env.LOG_FORMAT || 'json';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

const LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const minLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return LEVELS[level] >= minLevel;
}

function formatPretty(level, component, message, data) {
  const timestamp = new Date().toISOString();
  const levelPadded = level.toUpperCase().padEnd(5);
  const dataStr = Object.keys(data).length > 0
    ? ' ' + JSON.stringify(data)
    : '';
  return `${timestamp} ${levelPadded} [${component}] ${message}${dataStr}`;
}

function formatJson(level, component, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...data
  };
  return JSON.stringify(entry);
}

function log(level, component, message, data = {}) {
  if (!shouldLog(level)) return;

  const output = LOG_FORMAT === 'pretty'
    ? formatPretty(level, component, message, data)
    : formatJson(level, component, message, data);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (component, message, data) => log('debug', component, message, data),
  info: (component, message, data) => log('info', component, message, data),
  warn: (component, message, data) => log('warn', component, message, data),
  error: (component, message, data) => log('error', component, message, data),

  // Convenience method for logging errors with stack traces
  errorWithStack: (component, message, error, data = {}) => {
    log('error', component, message, {
      ...data,
      error: error.message,
      stack: error.stack
    });
  }
};
