import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { inspectRepository } from "../src/repository.js";

test("liest sichtbare Repository-Einträge", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-test-"),
  );

  try {
    await mkdir(path.join(temporaryDirectory, ".git"));
    await mkdir(path.join(temporaryDirectory, "node_modules"));
    await mkdir(path.join(temporaryDirectory, "src"));

    await writeFile(
      path.join(temporaryDirectory, "README.md"),
      "# Test",
    );

    const result = await inspectRepository(
      temporaryDirectory,
    );

    assert.deepEqual(result.entries, [
      {
        name: "README.md",
        type: "Datei",
      },
      {
        name: "src",
        type: "Ordner",
      },
    ]);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
