import { Clipboard, Toast, showToast } from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { checkApplication, runCmuxCommand } from "./utils";

export default async () => {
  const directory = ((await Clipboard.readText()) || "").trim();

  if (!directory) {
    await showToast(Toast.Style.Failure, "Clipboard doesn't contain a directory path");
    return;
  }

  try {
    await checkApplication("cmux");
    const result = await runCmuxCommand([directory]);
    await showToast(Toast.Style.Success, "Done", result);
  } catch (err) {
    await showFailureToast(err);
  }
};
