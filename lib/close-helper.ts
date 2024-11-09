/**
 * Fully reading a ReadableStream of an FsFile and then closing it
 * causes a BadResource error, maybe as a bug in Deno.
 * This function safely closes the file so that the program can
 * tear down the resource uniformly in a finally block in both cases.
 * @param file a file to close
 */
export function safeCloseFile(file: Deno.FsFile) {
  try {
    file.close();
  } catch (e) {
    if (e instanceof Deno.errors.BadResource) {
      // Ignore
    } else {
      throw e;
    }
  }
}
