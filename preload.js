'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  auth: {
    login: (u, p) => ipcRenderer.sendSync('auth:login', u, p),
    status: () => ipcRenderer.sendSync('auth:status'),
    logout: () => ipcRenderer.sendSync('auth:logout'),
    changePassword: (oldPass, newPass) => ipcRenderer.sendSync('db:changePassword', oldPass, newPass)
  },
  db: {
    load: () => ipcRenderer.sendSync('db:load'),
    save: snapshot => ipcRenderer.sendSync('db:save', snapshot),
    backup: () => ipcRenderer.sendSync('db:backup'),
    barcode: code => ipcRenderer.sendSync('db:barcode', code),
    report: period => ipcRenderer.sendSync('db:report', period),
    exportCsv: type => ipcRenderer.sendSync('db:exportCsv', type)
  }
});
