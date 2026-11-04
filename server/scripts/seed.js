import 'dotenv/config';
import bcrypt from 'bcryptjs';
import {pool,transaction,sql} from '../src/db.js';
const entries=[
 {slug:'grocery',name:'Demo Grocery Market',profile:'grocery',products:[['Fresh Bread','Bakery',145,'bread.svg'],['Whole Milk','Dairy',180,'milk.svg'],['Rice 2kg','Pantry',350,'rice.svg'],['Fruit Juice','Beverages',220,'juice.svg']]},
 {slug:'food',name:'Demo Fast Food',profile:'food',products:[['Chicken Meal','Meals',780,'chicken.svg'],['Classic Burger','Burgers',620,'burger.svg'],['Soft Drink','Drinks',150,'soda.svg']]},
 {slug:'fashion',name:'Demo Fashion Store',profile:'clothing',products:[['Basic T-Shirt','Tops',950,'shirt.svg'],['Denim Jeans','Bottoms',2750,'jeans.svg'],['Hoodie','Outerwear',3500,'hoodie.svg']]}
];
// Optional demo staff: set DEMO_STAFF_PASSWORD (12+ chars, upper/lower/digit) in server/.env before running `npm run db:seed`.
const demoPassword=process.env.DEMO_STAFF_PASSWORD;
try{if(process.env.NODE_ENV==='production')throw Error('Demo seed is disabled in production');
for(const entry of entries){const existing=await sql('SELECT id FROM businesses WHERE name=$1',[entry.name]);if(existing.rowCount){console.log('Already seeded:',entry.name);continue}await transaction(async c=>{
const b=(await c.query('INSERT INTO businesses(name,profile) VALUES($1,$2) RETURNING id',[entry.name,entry.profile])).rows[0];const r=(await c.query("INSERT INTO branches(business_id,name) VALUES($1,'Main branch') RETURNING id",[b.id])).rows[0];for(const [name,category,price,image] of entry.products){const variants=entry.profile==='clothing'?[{id:'s',name:'Small'},{id:'m',name:'Medium'},{id:'l',name:'Large'}]:[{id:'default',name:'Standard'}];const p=(await c.query('INSERT INTO products(business_id,name,category,price_cents,image,variants) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[b.id,name,category,price,`/sample-products/${image}`,JSON.stringify(variants)])).rows[0];for(const variant of variants)await c.query('INSERT INTO inventory(business_id,branch_id,product_id,variant_id,quantity) VALUES($1,$2,$3,$4,25)',[b.id,r.id,p.id,variant.id])}console.log('Seeded:',entry.name)})}
if(demoPassword){
 if(demoPassword.length<12||!/[A-Z]/.test(demoPassword)||!/[a-z]/.test(demoPassword)||!/[0-9]/.test(demoPassword))throw Error('DEMO_STAFF_PASSWORD needs 12+ characters with upper/lowercase and a digit');
 const hash=await bcrypt.hash(demoPassword,12);console.log('\nDemo staff accounts (password = DEMO_STAFF_PASSWORD):');
 for(const entry of entries){
  const b=(await sql('SELECT id FROM businesses WHERE name=$1',[entry.name])).rows[0];const br=(await sql('SELECT id FROM branches WHERE business_id=$1 ORDER BY created_at LIMIT 1',[b.id])).rows[0];
  const accounts=[['business_admin',`admin.${entry.slug}@sstwas.demo`,`${entry.name} Admin`,null],['cashier',`cashier.${entry.slug}@sstwas.demo`,`${entry.name} Cashier`,br.id]];
  if(entry.profile==='food')accounts.push(['kitchen',`kitchen.${entry.slug}@sstwas.demo`,`${entry.name} Kitchen`,br.id]);
  for(const [role,email,display,branch] of accounts){const r=await sql('INSERT INTO staff(email,password_hash,role,business_id,branch_id,display_name,must_change_password) VALUES($1,$2,$3,$4,$5,$6,false) ON CONFLICT(email) DO NOTHING RETURNING id',[email,hash,role,b.id,branch,display]);console.log(`  ${role.padEnd(14)} ${email}${r.rowCount?'':'  (already exists)'}`)}
 }
}else console.log('\nTip: set DEMO_STAFF_PASSWORD in server/.env and run the seed again to create demo Admin / Cashier / Kitchen accounts.');
}catch(e){console.error('Seeding failed:',e.message);process.exitCode=1}finally{await pool.end()}
