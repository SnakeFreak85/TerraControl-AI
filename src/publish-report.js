export function formatPublishSuccessReport(
  pushedWorkOrder,
) {
  if (
    !pushedWorkOrder ||
    pushedWorkOrder.status !== "pushed" ||
    pushedWorkOrder.localCommitSha !==
      pushedWorkOrder.remoteCommitSha
  ) {
    throw new Error(
      "Ein Publish-Bericht benötigt einen eindeutig verifizierten Push.",
    );
  }

  const shortCommitSha =
    pushedWorkOrder.commitSha.slice(
      0,
      7,
    );

  const lines = [
    "=== TerraControl AI – Abschlussbericht ===",
    "",
    `Arbeitsauftrag: ${pushedWorkOrder.workOrderId}`,
    "Gesamtstatus: ERFOLGREICH VERÖFFENT",
    "",
    `Branch: ${pushedWorkOrder.branch}`,
    `Remote: ${pushedWorkOrder.remoteUrl}`,
    `Commit: ${shortCommitSha}`,
    `Commit-ID: ${pushedWorkOrder.commitSha}`,
    "",
    "Verifikation:",
    "- Lokaler Commit und Remote-Commit stimmen überein.",
    "- Es wurde kein Force-Push verwendet.",
    "- Der Arbeitsauftrag ist abgeschlossen.",
  ];

  return lines.join("\n");
}

export function formatPublishFailureReport(
  error,
) {
  if (!(error instanceof Error)) {
    throw new TypeError(
      "Ein Fehlerobjekt wird benötigt.",
    );
  }

  return [
    "=== TerraControl AI – Abschlussbericht ===",
    "",
    "Gesamtstatus: NICHT VERÖFFENT",
    `Fehler: ${error.message}`,
    "",
    "Ergebnis:",
    "- Der Push wurde nicht als erfolgreich bestätigt.",
    "- Ein Force-Push wurde nicht ausgeführt.",
    "- Der Repository-Status muss geprüft werden.",
  ].join("\n");
}
