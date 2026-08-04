import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../src/config.js";

test("verwendet standardmäßig das aktuelle Verzeichnis", () => {
  const cwd = path.resolve("test-repository");

  const config = loadConfig({
    cwd,
    env: {},
  });

  assert.equal(config.repositoryPath, cwd);
  assert.equal(config.logLevel, "info");
});

test("liest gültige Einstellungen aus der Umgebung", () => {
  const config = loadConfig({
    cwd: process.cwd(),
    env: {
      TERRACONTROL_REPOSITORY: "example-repository",
      TERRACONTROL_LOG_LEVEL: "debug",
    },
  });

  assert.equal(
    config.repositoryPath,
    path.resolve("example-repository"),
  );

  assert.equal(config.logLevel, "debug");
});

test("ersetzt ein ungültiges Log-Level durch info", () => {
  const config = loadConfig({
    cwd: process.cwd(),
    env: {
      TERRACONTROL_LOG_LEVEL: "ungueltig",
    },
  });

  assert.equal(config.logLevel, "info");
});
