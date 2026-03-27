// run-fetch.ts
import { fetchFiles } from "./coordinatorApi";

async function main() {
  try {
    const datasetHandle = "your-test-handle";

    const res = await fetchFiles(datasetHandle);

    console.log("RESULT:");
    console.dir(res, { depth: null });
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
