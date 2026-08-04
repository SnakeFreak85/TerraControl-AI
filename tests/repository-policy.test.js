import assert from "node:assert/strict";
import test from "node:test";

import {
  isReadableTextFile,
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

test("erlaubt unterstützte Text- und Quellcodedateien", () => {
  assert.equal(isReadableTextFile("application.js"), true);
  assert.equal(isReadableTextFile("Component.tsx"), true);
  assert.equal(isReadableTextFile("styles.css"), true);
  assert.equal(isReadableTextFile("README.md"), true);
  assert.equal(isReadableTextFile(".gitignore"), true);
  assert.equal(isReadableTextFile(".env.example"), true);
});

test("lehnt Binärdateien und Geheimnisse ab", () => {
  assert.equal(isReadableTextFile("photo.jpg"), false);
  assert.equal(isReadableTextFile("archive.zip"), false);
  assert.equal(isReadableTextFile("database.sqlite"), false);
  assert.equal(isReadableTextFile(".env"), false);
  assert.equal(isReadableTextFile("private.key"), false);
});

test("definiert feste Scanner-Grenzen", () => {
  assert.equal(repositoryLimits.maximumFiles, 5000);

  assert.equal(
    repositoryLimits.maximumFileSizeBytes,
    256 * 1024,
  );

  assert.equal(
    repositoryLimits.maximumTotalContentBytes,
    2 * 1024 * 1024,
  );
});
