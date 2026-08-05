import assert from "node:assert/strict";
import test from "node:test";

import {
  formatPublishFailureReport,
  formatPublishSuccessReport,
} from "../src/publish-report.js";

const pushedWorkOrder = Object.freeze({
  status: "pushed",
  workOrderId: "work-order-001",
  branch: "main",
  remoteUrl:
    "https://github.com/example/project.git",
  commitSha:
    "0123456789abcdef0123456789abcdef01234567",
  localCommitSha:
    "0123456789abcdef0123456789abcdef01234567",
  remoteCommitSha:
    "0123456789abcdef0123456789abcdef01234567",
});

test("formatiert einen verifizierten Publish-Bericht", () => {
  const report =
    formatPublishSuccessReport(
      pushedWorkOrder,
    );

  assert.match(
    report,
    /ERFOLGREICH VERÖFFENT/,
  );

  assert.match(report, /Branch: main/);
  assert.match(report, /Commit: 0123456/);

  assert.match(
    report,
    /Lokaler Commit und Remote-Commit stimmen überein/,
  );

  assert.match(
    report,
    /kein Force-Push/,
  );
});

test("lehnt einen nicht verifizierten Push ab", () => {
  assert.throws(
    () =>
      formatPublishSuccessReport({
        ...pushedWorkOrder,
        remoteCommitSha:
          "abcdef0123456789abcdef0123456789abcdef01",
      }),
    /eindeutig verifizierten Push/,
  );
});

test("formatiert einen fehlgeschlagenen Publish-Bericht", () => {
  const report =
    formatPublishFailureReport(
      new Error(
        "Remote konnte nicht verifiziert werden.",
      ),
    );

  assert.match(
    report,
    /NICHT VERÖFFENT/,
  );

  assert.match(
    report,
    /Remote konnte nicht verifiziert/,
  );

  assert.match(
    report,
    /Force-Push wurde nicht ausgeführt/,
  );
});
