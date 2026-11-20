import fs from "node:fs";

// Remove the throwaway test databases once all tests have finished.
export default function () {
  return () => fs.rmSync("./data/test", { recursive: true, force: true });
}
