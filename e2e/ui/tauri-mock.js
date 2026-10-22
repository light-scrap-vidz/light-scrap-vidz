// Stands in for the Tauri runtime inside the page, so the real built frontend can be driven
// in a plain browser. Tests configure it through `window.__lsv`:
//   __lsv.handlers[command] = (args) => result     what a backend command answers
//   __lsv.calls                                    every invoke the app made, in order
//   __lsv.emit(event, payload)                     what the Rust side would emit
(() => {
  const callbacks = new Map();
  const listeners = [];
  let nextId = 1;

  const lsv = {
    handlers: {
      detect_installed_browsers: () => ['firefox'],
      install_kind: () => 'deb',
      fetch_thumbnail: () => new Error('no thumbnail in tests'),
      'plugin:app|version': () => '1.1.0',
      'plugin:notification|is_permission_granted': () => true,
      'plugin:notification|notify': () => undefined,
    },
    calls: [],
    emit(event, payload) {
      for (const l of listeners.filter((x) => x.event === event)) {
        const cb = callbacks.get(l.handler);
        if (cb) cb({ event, id: l.id, payload });
      }
    },
  };
  window.__lsv = lsv;

  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener(event, id) {
      const i = listeners.findIndex((l) => l.event === event && l.id === id);
      if (i >= 0) listeners.splice(i, 1);
    },
  };

  window.__TAURI_INTERNALS__ = {
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { windowLabel: 'main', label: 'main' },
    },
    convertFileSrc: (path) => path,
    transformCallback(cb) {
      const id = nextId++;
      callbacks.set(id, cb);
      return id;
    },
    unregisterCallback(id) {
      callbacks.delete(id);
    },
    async invoke(cmd, args) {
      lsv.calls.push({ cmd, args });
      if (cmd === 'plugin:event|listen') {
        const id = nextId++;
        listeners.push({ event: args.event, id, handler: args.handler });
        return id;
      }
      if (cmd === 'plugin:event|unlisten') return undefined;
      const handler = lsv.handlers[cmd];
      if (!handler) return undefined;
      const result = handler(args);
      if (result instanceof Error) throw result.message;
      return result;
    },
  };
})();
