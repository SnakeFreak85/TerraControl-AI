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

import { readRepositoryFiles } from "../src/content-reader.js";

test("liest erlaubte Textdateien und überspringt ungeeignete Dateien", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-content-"),
  );

  try {
    await mkdir(path.join(temporaryDirectory, "src"));

    await writeFile(
      path.join(temporaryDirectory, "src", "app.js"),
      "console.log('safe');",
    );

    await writeFile(
      path.join(temporaryDirectory, "photo.jpg"),
      "not a real image",
    );

    await writeFile(
      path.join(temporaryDirectory, "data.json"),
      Buffer.from([0, 1, 2, 3]),
    );

    await writeFile(
      path.join(temporaryDirectory, ".env"),
      "SECRET=hidden",
    );

    const result = await readRepositoryFiles(
      temporaryDirectory,
      [
        "src/app.js",
        "photo.jpg",
        "data.json",
        ".env",
      ],
    );

    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].path, "src/app.js");
    assert.equal(
      result.files[0].content,
      "console.log('safe');",
    );

    assert.equal(result.skipped.unsupportedFiles, 2);
    assert.equal(result.skipped.binaryFiles, 1);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("verhindert Pfade außerhalb des Repositorys", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-path-"),
  );

  try {
    await assert.rejects(
      readRepositoryFiles(
        temporaryDirectory,
        ["../outside.js"],
      ),
      /außerhalb des Repositorys/,
    );
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});

test("wendet Datei- und Gesamtgrößenlimits an", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-limits-"),
  );

  try {
    await writeFile(
      path.join(temporaryDirectory, "first.txt"),
      "123456",
    );

    await writeFile(
      path.join(temporaryDirectory, "second.txt"),
      "abcdef",
    );

    await writeFile(
      path.join(temporaryDirectory, "large.txt"),
      "12345678901",
    );

    const result = await readRepositoryFiles(
      temporaryDirectory,
      [
        "first.txt",
        "second.txt",
        "large.txt",
      ],
      {
        maximumFileSizeBytes: 10,
        maximumTotalContentBytes: 8,
      },
    );

    assert.deepEqual(
      result.files.map((file) => file.path),
      ["first.txt"],
    );

    assert.equal(result.totalContentBytes, 6);
    assert.equal(result.skipped.totalLimitFiles, 1);
    assert.equal(result.skipped.oversizedFiles, 1);
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    });
  }
});
