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

import {
  inspectRepository,
  scanRepository,
} from "../src/repository.js";

test("liest sichtbare Einträge der obersten Ebene", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-inspect-"),
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

test("scannt rekursiv und wendet Sicherheitsregeln an", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-scan-"),
  );

  try {
    await mkdir(path.join(temporaryDirectory, ".git"));
    await mkdir(path.join(temporaryDirectory, "node_modules"));
    await mkdir(path.join(temporaryDirectory, "src"));

    await writeFile(
      path.join(temporaryDirectory, ".env"),
      "SECRET=hidden",
    );

    await writeFile(
      path.join(temporaryDirectory, ".env.example"),
      "SECRET=",
    );

    await writeFile(
      path.join(temporaryDirectory, "README.md"),
      "# Test",
    );

    await writeFile(
      path.join(temporaryDirectory, "src", "app.js"),
      "console.log('test');",
    );

    await writeFile(
      path.join(temporaryDirectory, "large.bin"),
      Buffer.alloc(101),
    );

    await writeFile(
      path.join(
        temporaryDirectory,
        "node_modules",
        "dependency.js",
      ),
      "ignored",
    );

    const result = await scanRepository(
      temporaryDirectory,
      {
        maximumFiles: 100,
        maximumFileSizeBytes: 100,
      },
    );

    assert.deepEqual(
      result.files.map((file) => file.path),
      [
        ".env.example",
        "README.md",
        "src/app.js",
      ],
    );

    assert.deepEqual(result.skipped, {
      directories: 2,
      sensitiveFiles: 1,
      oversizedFiles: 1,
      symbolicLinks: 0,
    });

    assert.equal(result.truncated, false);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
