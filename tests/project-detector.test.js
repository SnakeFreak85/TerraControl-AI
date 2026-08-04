import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { detectProject } from "../src/project-detector.js";

test("erkennt ein Node.js-Projekt und seine Befehle", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-project-"),
  );

  try {
    await writeFile(
      path.join(temporaryDirectory, "package.json"),
      JSON.stringify({
        name: "example-project",
        scripts: {
          test: "node --test",
          build: "node build.js",
        },
      }),
    );

    await writeFile(
      path.join(temporaryDirectory, "package-lock.json"),
      "{}",
    );

    const result = await detectProject(
      temporaryDirectory,
    );

    assert.equal(result.type, "node");
    assert.equal(result.manifest, "package.json");
    assert.equal(result.packageManager, "npm");

    assert.deepEqual(result.scripts, {
      build: "node build.js",
      test: "node --test",
    });
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("meldet unbekannte Projekte ohne package.json", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-unknown-"),
  );

  try {
    const result = await detectProject(
      temporaryDirectory,
    );

    assert.equal(result.type, "unknown");
    assert.equal(result.manifest, null);
    assert.equal(result.packageManager, null);
    assert.deepEqual(result.scripts, {});
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
