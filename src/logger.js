const priorities = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger({
  level = "info",
  output = console,
} = {}) {
  const minimumPriority =
    priorities[level] ?? priorities.info;

  function write(entryLevel, message, details) {
    if (priorities[entryLevel] < minimumPriority) {
      return;
    }

    const timestamp = new Date().toISOString();
    const detailText = details
      ? ` ${JSON.stringify(details)}`
      : "";

    const line =
      `[${timestamp}] ${entryLevel.toUpperCase()} ${message}${detailText}`;

    if (entryLevel === "error") {
      output.error(line);
    } else if (entryLevel === "warn") {
      output.warn(line);
    } else {
      output.log(line);
    }
  }

  return Object.freeze({
    debug: (message, details) =>
      write("debug", message, details),

    info: (message, details) =>
      write("info", message, details),

    warn: (message, details) =>
      write("warn", message, details),

    error: (message, details) =>
      write("error", message, details),
  });
}
