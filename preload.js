'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cliGuide', {
  loadCommands: () => ipcRenderer.invoke('commands:load'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (partial) => ipcRenderer.invoke('config:save', partial),
  copyText: (text) => ipcRenderer.invoke('clipboard:copy', text),
  togglePanel: () => ipcRenderer.invoke('panel:toggle'),
  hidePanel: () => ipcRenderer.invoke('panel:hide'),
  dragMove: (dx, dy) => ipcRenderer.invoke('window:drag-move', dx, dy),
  setLoginItem: (enabled) => ipcRenderer.invoke('login:set', enabled),
  openDataDir: () => ipcRenderer.invoke('data:open-dir'),
  quit: () => ipcRenderer.invoke('app:quit'),
  onWindowState: (cb) => ipcRenderer.on('window:state', (_e, state) => cb(state))
});
