import { defineConfig, createLogger } from 'vite';

const logger = createLogger();
const originalWarn = logger.warn;

logger.warn = (msg, options) => {
  // Ignore sourcemap warnings from dependencies in node_modules
  if (msg.includes('Sourcemap') || msg.includes('missing source files')) {
    return;
  }
  // Ignore ESM/CJS interop warnings from dependencies
  if (msg.includes('Unable to interop') || msg.includes('lose module exports')) {
    return;
  }
  originalWarn(msg, options);
};

export default defineConfig({
  customLogger: logger,
});
