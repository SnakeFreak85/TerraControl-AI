export const qualityReportLimits = Object.freeze({
  maximumOutputLines: 40,
  maximumOutputCharacters: 4000,
});

function limitOutput(output) {
  if (
    typeof output !== "string" ||
    output.length === 0
  ) {
    return "(keine Ausgabe)";
  }

  const lines = output.split(/\r?\n/);

  const limitedLines = lines.slice(
    -qualityReportLimits.maximumOutputLines,
  );

  let limitedOutput = limitedLines.join("\n");

  if (
    limitedOutput.length >
    qualityReportLimits.maximumOutputCharacters
  ) {
    limitedOutput = limitedOutput.slice(
      -qualityReportLimits.maximumOutputCharacters,
    );
  }

  const wasLimited =
    lines.length > limitedLines.length ||
    output.length > limitedOutput.length;

  return wasLimited
    ? `[Ausgabe gekürzt]\n${limitedOutput}`
    : limitedOutput;
}

function findCommandResult(error) {
  let currentValue = error;

  while (currentValue) {
    if (
      typeof currentValue === "object" &&
      typeof currentValue.scriptName ===
        "string" &&
      Object.hasOwn(
        currentValue,
        "exitCode",
      )
    ) {
      return currentValue;
    }

    currentValue =
      currentValue.cause;
  }

  return null;
}

export function formatQualitySuccessReport(
  validatedWorkOrder,
) {
  if (
    !validatedWorkOrder ||
    validatedWorkOrder.status !== "validated" ||
    !validatedWorkOrder.validation ||
    !Array.isArray(
      validatedWorkOrder.validation.results,
    )
  ) {
    throw new Error(
      "Ein Qualitätsbericht benötigt einen erfolgreich validierten Arbeitsauftrag.",
    );
  }

  const lines = [
    "=== TerraControl AI – Qualitätsbericht ===",
    "",
    `Auftrag: ${validatedWorkOrder.id}`,
    "Gesamtstatus: ERFOLGREICH",
    "",
    "Geänderte Dateien:",
  ];

  for (
    const file of
    validatedWorkOrder.appliedFiles
  ) {
    lines.push(`- ${file}`);
  }

  lines.push(
    "",
    "Validierungen:",
  );

  for (
    const result of
    validatedWorkOrder.validation.results
  ) {
    lines.push(
      "",
      `✓ ${result.displayCommand}`,
      `  Exit-Code: ${result.exitCode}`,
      `  Laufzeit: ${result.durationMs} ms`,
      `  Ausgabe:`,
      ...limitOutput(
        result.standardOutput ||
          result.errorOutput,
      )
        .split("\n")
        .map((line) => `    ${line}`),
    );
  }

  lines.push(
    "",
    `Git-Diff: ${validatedWorkOrder.diff.sizeBytes} Bytes`,
    "",
    "Nächster Schritt:",
    "- Änderungen können zur Commit-Prüfung freigegeben werden.",
    "- Es wurde noch kein Commit oder Push ausgeführt.",
  );

  return lines.join("\n");
}

export function formatQualityFailureReport(
  error,
) {
  if (!(error instanceof Error)) {
    throw new TypeError(
      "Ein Fehlerobjekt wird benötigt.",
    );
  }

  const commandResult =
    findCommandResult(error);

  const lines = [
    "=== TerraControl AI – Qualitätsbericht ===",
    "",
    "Gesamtstatus: FEHLGESCHLAGEN",
    `Fehler: ${error.message}`,
  ];

  if (commandResult) {
    lines.push(
      "",
      `Fehlgeschlagener Befehl: ${commandResult.displayCommand}`,
      `Exit-Code: ${commandResult.exitCode}`,
      `Laufzeit: ${commandResult.durationMs} ms`,
      "Relevante Ausgabe:",
      ...limitOutput(
        commandResult.errorOutput ||
          commandResult.standardOutput,
      )
        .split("\n")
        .map((line) => `  ${line}`),
    );
  }

  lines.push(
    "",
    "Ergebnis:",
    "- Der Arbeitsauftrag wurde nicht freigegeben.",
    "- Geplante Änderungen wurden soweit sicher möglich zurückgesetzt.",
    "- Es wurde kein Commit oder Push ausgeführt.",
  );

  return lines.join("\n");
}
