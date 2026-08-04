import assert from "node:assert/strict";
import test from "node:test";

import {
  isSensitiveFile,
  repositoryLimits,
  shouldIgnoreDirectory,
} from "../src/repository-policy.js";

test("ignoriert Abhängigkeits- und Ausgabeordner", () => {
  assert.equal(shouldIgnoreDirectory("node_modules"), true);
  assert.equal(shouldIgnoreDirectory("DIST"), true);
  assert.equal(shouldIgnoreDirectory("src"), false);
});

test("erkennt Umgebungsdateien als sensibel", () => {
  assert.equal(isSensitiveFile(".env"), true);
  assert.equal(isSensitiveFile(".env.local"), true);
  assert.equal(isSensitiveFile(".env.production"), true);
});

test("erlaubt die Vorlage .env.example", () => {
  assert.equal(isSensitiveFile(".env.example"), false);
});

test("erkennt Schlüssel- und Zertifikatsdateien", () => {
  assert.equal(isSensitiveFile("private.key"), true);
  assert.equal(isSensitiveFile("certificate.pem"), true);
  assert.equal(isSensitiveFile("application.js"), false);
});

test("definiert feste Scanner-Grenzen", () => {
  assert.equal(repositoryLimits.maximumFiles, 5000);
  assert.equal(
    repositoryLimits.maximumFileSizeBytes,
    256 * 1024,
  );
});
