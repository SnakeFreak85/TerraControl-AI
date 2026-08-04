import {
  repositoryLimits,
} from "./repository-policy.js";

export function createChangeDrafts(
  plannedWorkOrder,
  readableContent,
  proposedChanges,
) {
  if (
    !plannedWorkOrder ||
    plannedWorkOrder.status !== "planned"
  ) {
    throw new Error(
      "Änderungsvorschläge benötigen einen geplanten Arbeitsauftrag.",
    );
  }

  if (
    !readableContent ||
    !Array.isArray(readableContent.files)
  ) {
    throw new TypeError(
      "Änderungsvorschläge benötigen gelesene Dateiinhalte.",
    );
  }

  if (
    !Array.isArray(proposedChanges) ||
    proposedChanges.length === 0
  ) {
    throw new TypeError(
      "Mindestens ein Änderungsvorschlag wird benötigt.",
    );
  }

  const plannedFiles = new Set(
    plannedWorkOrder.plannedChanges.map(
      (change) => change.file,
    ),
  );

  const originalContentByFile = new Map(
    readableContent.files.map((file) => [
      file.path,
      file.content,
    ]),
  );

  const draftedFiles = new Set();

  const drafts = proposedChanges.map(
    (proposedChange) => {
      if (
        !proposedChange ||
        typeof proposedChange !== "object"
      ) {
        throw new TypeError(
          "Jeder Änderungsvorschlag muss ein Objekt sein.",
        );
      }

      const {
        file,
        content,
      } = proposedChange;

      if (
        typeof file !== "string" ||
        file.length === 0
      ) {
        throw new TypeError(
          "Jeder Änderungsvorschlag benötigt einen Dateipfad.",
        );
      }

      if (!plannedFiles.has(file)) {
        throw new Error(
          `Datei gehört nicht zum freigegebenen Änderungsplan: ${file}`,
        );
      }

      if (draftedFiles.has(file)) {
        throw new Error(
          `Für eine Datei ist nur ein Änderungsvorschlag erlaubt: ${file}`,
        );
      }

      if (typeof content !== "string") {
        throw new TypeError(
          `Der neue Inhalt muss Text sein: ${file}`,
        );
      }

      const proposedSizeBytes =
        Buffer.byteLength(content, "utf8");

      if (
        proposedSizeBytes >
        repositoryLimits.maximumFileSizeBytes
      ) {
        throw new RangeError(
          `Der vorgeschlagene Inhalt ist zu groß: ${file}`,
        );
      }

      if (!originalContentByFile.has(file)) {
        throw new Error(
          `Originalinhalt wurde nicht sicher geladen: ${file}`,
        );
      }

      const originalContent =
        originalContentByFile.get(file);

      if (content === originalContent) {
        throw new Error(
          `Der Vorschlag enthält keine Änderung: ${file}`,
        );
      }

      draftedFiles.add(file);

      return Object.freeze({
        file,
        originalContent,
        proposedContent: content,
        originalSizeBytes:
          Buffer.byteLength(
            originalContent,
            "utf8",
          ),
        proposedSizeBytes,
      });
    },
  );

  for (const plannedFile of plannedFiles) {
    if (!draftedFiles.has(plannedFile)) {
      throw new Error(
        `Für die geplante Datei fehlt ein Änderungsvorschlag: ${plannedFile}`,
      );
    }
  }

  return Object.freeze({
    ...plannedWorkOrder,
    status: "drafted",
    drafts: Object.freeze(drafts),
  });
}
