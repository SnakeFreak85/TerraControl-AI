import assert from "node:assert/strict";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  revertAppliedChangeDrafts,
} from "../src/change-writer.js";

function createAppliedWorkOrder(
  repositoryPath,
  drafts,
) {
  return Object.freeze({
    id: "work-order-001",
    repositoryPath,
    status: "diff-verified",
    drafts: Object.freeze(
      drafts.map((draft) =>
        Object.freeze(draft),
      ),
    ),
    appliedFiles: Object.freeze(
      drafts.map((draft) => draft.file),
    ),
  });
}

test("setzt angewendete Änderungen zurück", async () => {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-revert-"),
  );

  const filePath = path.join(
    repositoryPath,
    "example.txt",
  );

  try {
    await writeFile(
      filePath,
      "changed",
      "utf8",
    );

    const result =
      await revertAppliedChangeDrafts(
        createAppliedWorkOrder(
          repositoryPath,
          [
            {
              file: "example.txt",
              originalContent: "original",
              proposedContent: "changed",
            },
          ],
        ),
      );

    assert.equal(result.status, "reverted");

    assert.deepEqual(
      result.revertedFiles,
      ["example.txt"],
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "original",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("überschreibt keine nachträglich veränderte Datei", async () => {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-concurrent-"),
  );

  const filePath = path.join(
    repositoryPath,
    "example.txt",
  );

  try {
    await writeFile(
      filePath,
      "changed-after-validation",
      "utf8",
    );

    await assert.rejects(
      revertAppliedChangeDrafts(
        createAppliedWorkOrder(
          repositoryPath,
          [
            {
              file: "example.txt",
              originalContent: "original",
              proposedContent: "proposed",
            },
          ],
        ),
      ),
      /unerwartet verändert/,
    );

    assert.equal(
      await readFile(filePath, "utf8"),
      "changed-after-validation",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});

test("stellt bei einem Rücksetzfehler den angewendeten Zustand wieder her", async () => {
  const repositoryPath = await mkdtemp(
    path.join(os.tmpdir(), "terracontrol-recovery-"),
  );

  const firstPath = path.join(
    repositoryPath,
    "first.txt",
  );

  const secondPath = path.join(
    repositoryPath,
    "second.txt",
  );

  try {
    await writeFile(
      firstPath,
      "first-changed",
    );

    await writeFile(
      secondPath,
      "second-changed",
    );

    let replacementCall = 0;

    const controlledReplacer = async (
      filePath,
      content,
    ) => {
      replacementCall += 1;

      if (replacementCall === 2) {
        throw new Error(
          "Simulierter Rücksetzfehler",
        );
      }

      await writeFile(
        filePath,
        content,
        "utf8",
      );
    };

    await assert.rejects(
      revertAppliedChangeDrafts(
        createAppliedWorkOrder(
          repositoryPath,
          [
            {
              file: "first.txt",
              originalContent:
                "first-original",
              proposedContent:
                "first-changed",
            },
            {
              file: "second.txt",
              originalContent:
                "second-original",
              proposedContent:
                "second-changed",
            },
          ],
        ),
        {
          fileReplacer:
            controlledReplacer,
        },
      ),
      /angewendete Zustand wurde wiederhergestellt/,
    );

    assert.equal(
      await readFile(firstPath, "utf8"),
      "first-changed",
    );

    assert.equal(
      await readFile(secondPath, "utf8"),
      "second-changed",
    );
  } finally {
    await rm(repositoryPath, {
      recursive: true,
      force: true,
    });
  }
});
