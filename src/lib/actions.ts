import { toast } from "sonner";
import { isModelFile, isTauri, pickModelPaths, sourceFromPath, sourcesFromFiles } from "./platform";
import { useApp } from "../store/appStore";
import { t } from "../i18n";

/** "Open" button / Ctrl+O: native dialog on desktop, file input in a browser. */
export async function openFilesDialog(): Promise<void> {
  if (isTauri) {
    try {
      openPaths(await pickModelPaths());
    } catch (err) {
      toast.error(t("toast.dialogFailed"), { description: String(err) });
    }
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.accept = ".fbx,.obj,.dae,.mtl,.png,.jpg,.jpeg,.tga,.dds,.bmp,.webp";
  input.onchange = () => openFiles([...(input.files ?? [])]);
  input.click();
}

export function openPaths(paths: string[]): void {
  const models = paths.filter(isModelFile);
  warnUnsupported(paths.length - models.length);
  useApp.getState().openSources(models.map(sourceFromPath));
}

export function openFiles(files: File[]): void {
  const sources = sourcesFromFiles(files);
  if (!sources.length) warnUnsupported(files.length);
  useApp.getState().openSources(sources);
}

function warnUnsupported(count: number) {
  if (count > 0) {
    toast.warning(t("toast.unsupportedTitle"), {
      description: t("toast.unsupportedBody"),
    });
  }
}
