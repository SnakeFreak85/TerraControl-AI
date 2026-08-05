import path from "node:path";

const allowedLogLevels = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

function parsePositiveInteger(
  value,
  fallback,
) {
  if (
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) &&
    parsedValue > 0
    ? parsedValue
    : fallback;
}

export function loadConfig({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const repositoryPath = path.resolve(
    env.TERRACONTROL_REPOSITORY || cwd,
  );

  const requestedLogLevel =
    env.TERRACONTROL_LOG_LEVEL || "info";

  const logLevel = allowedLogLevels.has(
    requestedLogLevel,
  )
    ? requestedLogLevel
    : "info";

  return Object.freeze({
    repositoryPath,
    logLevel,
    ollamaBaseUrl:
      env.TERRACONTROL_OLLAMA_URL ||
      "http://127.0.0.1:11434",
    ollamaModel:
      env.TERRACONTROL_OLLAMA_MODEL ||
      "qwen2.5-coder:7b",
    ollamaTimeoutMs:
      parsePositiveInteger(
        env.TERRACONTROL_OLLAMA_TIMEOUT_MS,
        10 * 60 * 1000,
      ),
    ollamaContextSize:
      parsePositiveInteger(
        env.TERRACONTROL_OLLAMA_CONTEXT,
        4096,
      ),
  });
}
