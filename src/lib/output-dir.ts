const OUTPUT_DIR_KEY = 'light-scrap-vidz:outputDir';
const LEGACY_OUTPUT_DIR_KEY = 'light-scrap-vidZ:outputDir';

/** Read the saved output folder, adopting the pre-rename key on first run. */
export function loadOutputDir(): string {
  let dir = localStorage.getItem(OUTPUT_DIR_KEY);
  if (dir === null) {
    dir = localStorage.getItem(LEGACY_OUTPUT_DIR_KEY);
    if (dir !== null) {
      localStorage.setItem(OUTPUT_DIR_KEY, dir);
      localStorage.removeItem(LEGACY_OUTPUT_DIR_KEY);
    }
  }
  return dir ?? '';
}

export function saveOutputDir(dir: string): void {
  localStorage.setItem(OUTPUT_DIR_KEY, dir);
}
