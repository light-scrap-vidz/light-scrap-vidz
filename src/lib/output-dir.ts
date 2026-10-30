import { getItem, removeItem, setItem } from './storage';

const OUTPUT_DIR_KEY = 'light-scrap-vidz:outputDir';
const LEGACY_OUTPUT_DIR_KEY = 'light-scrap-vidZ:outputDir';

/** Read the saved output folder, adopting the pre-rename key on first run. */
export function loadOutputDir(): string {
  let dir = getItem(OUTPUT_DIR_KEY);
  if (dir === null) {
    dir = getItem(LEGACY_OUTPUT_DIR_KEY);
    if (dir !== null) {
      setItem(OUTPUT_DIR_KEY, dir);
      removeItem(LEGACY_OUTPUT_DIR_KEY);
    }
  }
  return dir ?? '';
}

export function saveOutputDir(dir: string): void {
  setItem(OUTPUT_DIR_KEY, dir);
}
