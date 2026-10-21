/** Noms des événements émis par le backend. Gardés identiques aux constantes `EVENT_*` de
 * `src-tauri/src/commands/download_runner.rs` ; le test `ipc-contract` le vérifie. */
export const EVENT_PROGRESS = 'download://progress';
export const EVENT_COMPLETE = 'download://complete';
export const EVENT_ERROR = 'download://error';
