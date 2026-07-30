/* The build-local M13 policy artifact never starts this fail-closed worker.
 * It occupies the fixed bootstrap name so the inventory cannot grow silently. */
self.onmessage = () => { self.close(); };
