#!/usr/bin/env node
/**
 * Electron 43+ no longer postinstalls its binary; download via npmmirror by default.
 */
const { spawnSync } = require('child_process');
const path = require('path');

process.env.ELECTRON_MIRROR =
  process.env.ELECTRON_MIRROR || 'https://npmmirror.com/mirrors/electron/';
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/';

const installJs = path.join(__dirname, '..', 'node_modules', 'electron', 'install.js');
const result = spawnSync(process.execPath, [installJs], {
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status === null ? 1 : result.status);
