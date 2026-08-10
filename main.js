'use strict';
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const sessions = new Set();
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1100, minHeight: 720,
    backgroundColor: '#0d1219',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.webContents.on('destroyed', () => sessions.delete(win.webContents.id));
}
function requireSession(event) {
  if (!sessions.has(event.sender.id)) throw new Error('UNAUTHORIZED');
}

ipcMain.on('auth:login', (event, username, password) => {
  const result = db.login(username, password);
  if (result.ok) { sessions.add(event.sender.id); db.audit('LOGIN', `تسجيل دخول: ${username}`); }
  event.returnValue = result;
});
ipcMain.on('auth:status', event => { event.returnValue = { loggedIn: sessions.has(event.sender.id) }; });
ipcMain.on('auth:logout', event => { sessions.delete(event.sender.id); db.audit('LOGOUT', 'تسجيل خروج'); event.returnValue = { ok: true }; });

ipcMain.on('db:load', event => { requireSession(event); event.returnValue = db.snapshot(); });
ipcMain.on('db:save', (event, snapshot) => {
  requireSession(event); event.returnValue = db.replaceSnapshot(snapshot); db.audit('DATA_SAVE', 'حفظ بيانات النظام');
});
ipcMain.on('db:backup', event => { requireSession(event); event.returnValue = db.snapshot(); });
ipcMain.on('db:barcode', (event, barcode) => { requireSession(event); event.returnValue = db.findBarcode(String(barcode || '').trim()); });
ipcMain.on('db:report', (event, period) => { requireSession(event); event.returnValue = db.report(period); });
ipcMain.on('db:changePassword', (event, oldPass, newPass) => {
  requireSession(event); event.returnValue = db.changePassword(oldPass, newPass); db.audit('PASSWORD_CHANGE', 'تغيير كلمة المرور');
});
ipcMain.on('db:exportCsv', (event, type) => { requireSession(event); event.returnValue = db.exportCsv(type); });

app.whenReady().then(() => { db.init(); createWindow(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); }); });
app.on('window-all-closed', () => { db.close(); if (process.platform !== 'darwin') app.quit(); });
process.on('uncaughtException', err => console.error(err));
