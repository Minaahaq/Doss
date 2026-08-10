'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
let sql;
const now = () => Date.now();
function dbPath() { const dir = path.join(require('electron').app.getPath('userData'), 'data'); fs.mkdirSync(dir, { recursive: true }); return path.join(dir, 'makhzeni.sqlite'); }
function init() {
  sql = new Database(dbPath());
  sql.pragma('journal_mode = WAL');
  sql.pragma('foreign_keys = ON');
  sql.exec(`CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, details TEXT, created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);`);
  const admin = sql.prepare('SELECT id FROM users WHERE username=?').get('admin');
  if (!admin) sql.prepare('INSERT INTO users(username,password_hash,role,created_at) VALUES(?,?,?,?)').run('admin', bcrypt.hashSync('admin123', 12), 'admin', now());
}
function login(username, password) { const u = sql.prepare('SELECT * FROM users WHERE username=?').get(username); return u && bcrypt.compareSync(password, u.password_hash) ? { ok:true, username:u.username, role:u.role } : { ok:false, error:'بيانات الدخول غير صحيحة' }; }
function changePassword(oldPass,newPass){ const u=sql.prepare('SELECT * FROM users WHERE username=?').get('admin'); if(!bcrypt.compareSync(oldPass,u.password_hash)) return {ok:false,error:'كلمة المرور الحالية غير صحيحة'}; if(!newPass||newPass.length<10) return {ok:false,error:'كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل'}; sql.prepare('UPDATE users SET password_hash=? WHERE id=?').run(bcrypt.hashSync(newPass,12),u.id); return {ok:true}; }
function getState(key, fallback){ const r=sql.prepare('SELECT value FROM app_state WHERE key=?').get(key); if(!r) return fallback; try{return JSON.parse(r.value)}catch{return fallback;} }
function setState(key,value){sql.prepare('INSERT INTO app_state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
function snapshot(){ return { products:getState('products',[]), operations:getState('operations',[]), customers:getState('customers',[]), sales:getState('sales',[]), expenses:getState('expenses',[]) }; }
function replaceSnapshot(s){ const tx=sql.transaction(()=>{ for(const k of ['products','operations','customers','sales','expenses']) setState(k,Array.isArray(s?.[k])?s[k]:[]); }); try{tx(); return {ok:true};}catch(e){return {ok:false,error:e.message};} }
function audit(action,details){ if(!sql) return; sql.prepare('INSERT INTO audit_log(action,details,created_at) VALUES(?,?,?)').run(action,details||'',now()); }
function findBarcode(barcode){ if(!barcode) return null; const products=getState('products',[]); for(const p of products){ if(String(p.barcode||'')===barcode) return p; for(const v of (p.variants||[])) if(String(v.barcode||'')===barcode) return {...p,variant:v,quantity:Number(v.quantity||0)}; } return null; }
function periodStart(period){const n=now(); if(period==='today') return new Date(new Date().setHours(0,0,0,0)).getTime(); if(period==='week') return n-7*864e5; if(period==='month') return n-30*864e5; return 0;}
function report(period='all'){const s=snapshot(),start=periodStart(period),sales=s.sales.filter(x=>x.createdAt>=start),expenses=s.expenses.filter(x=>x.createdAt>=start); let revenue=0,cost=0; for(const sale of sales){revenue+=Number(sale.total||0); for(const it of sale.items||[]){const p=s.products.find(x=>x.id===it.productId); cost+=(Number(p?.purchasePrice)||0)*Number(it.qty||0);}} const exp=expenses.reduce((a,e)=>a+Number(e.amount||0),0); return {revenue,cost,expenses:exp,grossProfit:revenue-cost,netProfit:revenue-cost-exp,invoices:sales.length,averageInvoice:sales.length?revenue/sales.length:0};}
function exportCsv(type){const s=snapshot(); const rows=type==='sales'?s.sales.map(x=>({invoice:x.number,total:x.total,date:new Date(x.createdAt).toISOString()})):s.products.map(x=>({name:x.name,sku:x.sku,barcode:x.barcode||'',quantity:x.quantity||0,salePrice:x.salePrice||0})); const keys=Object.keys(rows[0]||{}); return keys.join(',')+'\n'+rows.map(r=>keys.map(k=>`"${String(r[k]??'').replaceAll('"','""')}"`).join(',')).join('\n');}
function close(){if(sql) sql.close();}
module.exports={init,login,changePassword,snapshot,replaceSnapshot,audit,findBarcode,report,exportCsv,close};
