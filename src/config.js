import path from "node:path";

const allowedLogLevels = new Set([
  "debug",
  "info",
  "warn",
  "error",
]);

export function loadConfig({
  cwd = process.cwd(),
  env = process.env,
} = {}) {
  const repositoryPath = path.resolve(
    env.TERRACONTROL_REPOSITORY || cwd,
  );

  const requestedLogLevel =
    env.TERRACONTROL_LOG_LEVEL || "info";

  const logLevel = allowedLogLevels.has(requestedLogLevel)
    ? requestedLogLevel
    : "info";

  return Object.freeze({
    repositoryPath,
    logLevel,
  });
}
