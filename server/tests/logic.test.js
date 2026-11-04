import test from 'node:test';import assert from 'node:assert/strict';
import{cartItems,options,authorize,HttpError,integer,canManage,strongPassword,canAdvance,isBranchBound,PORTALS}from'../src/helpers.js';
test('no fractional quantities or weighing scales',()=>{assert.throws(()=>cartItems([{productId:'a',variantId:'default',quantity:1.5}]));assert.equal(cartItems([{productId:'a',variantId:'default',quantity:2}])[0].quantity,2)});
test('duplicate cart lines refused',()=>assert.throws(()=>cartItems([{productId:'a',variantId:'d',quantity:1},{productId:'a',variantId:'d',quantity:1}])));
test('simulated payments approved, declined or pending cashier',()=>{assert.equal(options('grocery','ecocash',{demoOutcome:'declined'}).paymentOutcome,'declined');assert.equal(options('food','card',{}).paymentOutcome,'approved');assert.equal(options('clothing','cash',{}).paymentOutcome,'pending')});
test('food-only service options',()=>{assert.equal(options('food','card',{serviceType:'dine_in'}).serviceType,'dine_in');assert.equal(options('grocery','card',{serviceType:'dine_in'}).serviceType,null)});
test('branch restrictions enforced for cashier and kitchen',()=>{assert.throws(()=>authorize({role:'cashier',business_id:'A',branch_id:'1'},['cashier'],'A','2'),HttpError);assert.throws(()=>authorize({role:'kitchen',business_id:'A',branch_id:'1'},['kitchen'],'A','2'),HttpError);assert.ok(isBranchBound('kitchen')&&!isBranchBound('business_admin'))});
test('only Super Admin can manage businesses',()=>{assert.throws(()=>authorize({role:'cashier'},['super_admin']),HttpError);assert.throws(()=>authorize({role:'business_admin',business_id:'A'},['super_admin'],'A'),HttpError)});
test('General Admin cannot reach another store',()=>assert.throws(()=>authorize({role:'business_admin',business_id:'A'},['business_admin'],'B'),HttpError));
test('temporary-password accounts are locked out until password changed',()=>assert.throws(()=>authorize({role:'cashier',business_id:'A',branch_id:'1',must_change_password:true},['cashier'],'A','1'),HttpError));
test('strong password policy',()=>{for(const bad of ['short1A','alllowercase123','ALLUPPERCASE123','NoNumbersHereAtAll',undefined,12345678901234])assert.throws(()=>strongPassword(bad),HttpError);assert.equal(strongPassword('Correct-Horse-9'),'Correct-Horse-9')});
test('account management hierarchy',()=>{
 const sa={role:'super_admin'},ga={role:'business_admin',business_id:'A'};
 assert.ok(canManage(sa,{role:'business_admin',business_id:'B'}));assert.ok(canManage(sa,{role:'super_admin'}));
 assert.ok(canManage(ga,{role:'cashier',business_id:'A'}));assert.ok(canManage(ga,{role:'kitchen',business_id:'A'}));
 assert.ok(!canManage(ga,{role:'cashier',business_id:'B'}));assert.ok(!canManage(ga,{role:'business_admin',business_id:'A'}));assert.ok(!canManage(ga,{role:'super_admin'}));
 assert.ok(!canManage({role:'cashier',business_id:'A'},{role:'cashier',business_id:'A'}));
});
test('food orders: Kitchen prepares, Cashier hands over',()=>{
 assert.ok(canAdvance('food','kitchen','new','preparing'));assert.ok(canAdvance('food','kitchen','preparing','ready'));
 assert.ok(!canAdvance('food','kitchen','ready','collected'));
 assert.ok(canAdvance('food','cashier','ready','collected'));assert.ok(!canAdvance('food','cashier','new','preparing'));
 assert.ok(!canAdvance('food','kitchen','new','ready'),'steps cannot be skipped');
});
test('fashion orders: Cashier runs every step, Kitchen has no access',()=>{
 for(const [a,b] of [['new','preparing'],['preparing','ready'],['ready','collected']]){assert.ok(canAdvance('clothing','cashier',a,b));assert.ok(!canAdvance('clothing','kitchen',a,b))}
 assert.ok(!canAdvance('grocery','cashier','new','preparing'));
});
test('portals: each station admits only its own staff (supervisors may enter)',()=>{
 assert.ok(!PORTALS.kitchen.roles.includes('cashier'));assert.ok(!PORTALS.cashier.roles.includes('kitchen'));assert.ok(!PORTALS.admin.roles.includes('cashier'));
 assert.ok(PORTALS.cashier.roles.includes('business_admin')&&PORTALS.kitchen.roles.includes('super_admin'));
});
