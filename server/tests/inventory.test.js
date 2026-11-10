import test from 'node:test';import assert from 'node:assert/strict';
import {assess,buildInsights} from '../src/inventory.js';
const row=(o={})=>({product_id:'p1',variant_id:'default',name:'Milk',variants:[{id:'default',name:'Standard'}],quantity:30,low_stock:5,u14:0,u30:0,expiry:null,expiry_days:null,...o});
test('out of stock is flagged first and suggests a reorder',()=>{const a=assess(row({quantity:0,u14:28}));assert.equal(a.status,'out');assert.equal(a.daysLeft,0);assert.equal(a.suggested,28)});
test('low stock when at or below the alert level',()=>assert.equal(assess(row({quantity:5,u14:1,u30:2})).status,'low'));
test('days of stock left uses the 14-day average',()=>{const a=assess(row({quantity:20,u14:28,u30:50}));assert.equal(a.avgDaily,2);assert.equal(a.daysLeft,10)});
test('reorder soon when 7 days or less remain',()=>{const a=assess(row({quantity:12,u14:28,u30:50}));assert.equal(a.status,'reorder_soon');assert.equal(a.suggested,16)});
test('slow mover when stocked but nothing sold in 30 days',()=>{const a=assess(row({quantity:40}));assert.equal(a.status,'slow');assert.equal(a.daysLeft,null);assert.equal(a.suggested,0)});
test('expiry: expired and expiring soon',()=>{assert.equal(assess(row({u14:1,u30:3,expiry_days:-1})).status,'expired');assert.equal(assess(row({quantity:50,u14:1,u30:3,expiry_days:5})).status,'expiring')});
test('healthy stock is ok and needs no order',()=>{const a=assess(row({quantity:100,u14:14,u30:30}));assert.equal(a.status,'ok');assert.equal(a.suggested,0)});
test('insights sort the most urgent first and summarise',()=>{
 const r=buildInsights([row({product_id:'a',name:'Fine',quantity:100,u14:14,u30:30}),row({product_id:'b',name:'Gone',quantity:0}),row({product_id:'c',name:'Low',quantity:3,u14:7,u30:9})],14);
 assert.deepEqual(r.items.map(i=>i.name),['Gone','Low','Fine']);assert.equal(r.summary.out,1);assert.equal(r.summary.low,1);assert.equal(r.summary.total,3)});
test('cover days are clamped',()=>{assert.equal(buildInsights([],9999).coverDays,90);assert.equal(buildInsights([],'x').coverDays,14)});
