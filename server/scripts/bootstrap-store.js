import {pool,transaction} from '../src/db.js';

const storeName='Chizzyboi Stores';
const foodStoreName='Chizzyboi Food';
const products=[
 ['White Bread','Bakery',145],
 ['Fresh Milk 1L','Dairy',180],
 ['Rice 2kg','Pantry',350],
 ['Cooking Oil 2L','Pantry',480],
 ['Sugar 2kg','Pantry',300],
 ['Eggs 30 Pack','Dairy',650],
 ['Cola 2L','Beverages',220],
 ['Bottled Water 500ml','Beverages',80],
 ['Bath Soap','Household',120],
 ['Laundry Soap 1kg','Household',320]
];
const meals=[
 ['Traditional Sadza & Beef','Main Meals',650],
 ['Chicken & Chips','Main Meals',700],
 ['Chicken Rice','Main Meals',620],
 ['Beef Burger & Chips','Burgers',580],
 ['Cheeseburger','Burgers',630],
 ['Beef Stew with Sadza','Main Meals',680],
 ['Chicken Tikka Wrap','Wraps',550],
 ['Vegetable Rice Bowl','Vegetarian',500],
 ['Fish & Chips','Main Meals',750],
 ['Chocolate Cake Slice','Desserts',280]
];

async function bootstrapStore(c,name,profile,starterProducts){
 let store=(await c.query('SELECT id FROM businesses WHERE name=$1 LIMIT 1',[name])).rows[0];
 if(!store){
  store=(await c.query('INSERT INTO businesses(name,profile) VALUES($1,$2) RETURNING id',[name,profile])).rows[0];
  console.log('Store created:',name);
 }else{
  console.log('Store already exists:',name);
 }
 let branch=(await c.query('SELECT id FROM branches WHERE business_id=$1 AND active ORDER BY created_at LIMIT 1',[store.id])).rows[0];
 if(!branch)branch=(await c.query("INSERT INTO branches(business_id,name) VALUES($1,'Main branch') RETURNING id",[store.id])).rows[0];
 for(const [productName,category,priceCents] of starterProducts){
  const existing=await c.query('SELECT id FROM products WHERE business_id=$1 AND name=$2 LIMIT 1',[store.id,productName]);
  let product=existing.rows[0];
  if(!product){
   product=(await c.query("INSERT INTO products(business_id,name,category,price_cents,variants,active) VALUES($1,$2,$3,$4,'[{\"id\":\"default\",\"name\":\"Standard\"}]',true) RETURNING id",[store.id,productName,category,priceCents])).rows[0];
  }
  await c.query("INSERT INTO inventory(business_id,branch_id,product_id,variant_id,quantity) VALUES($1,$2,$3,'default',25) ON CONFLICT (business_id,branch_id,product_id,variant_id) DO NOTHING",[store.id,branch.id,product.id]);
 }
 return starterProducts.length;
}

try{
 await transaction(async c=>{
  await bootstrapStore(c,storeName,'grocery',products);
  await bootstrapStore(c,foodStoreName,'food',meals);
 });
 console.log(`Store ${storeName} has ${products.length} starter products.`);
 console.log(`Food store ${foodStoreName} has ${meals.length} starter meals.`);
}catch(error){
 console.error('Store bootstrap failed:',error.message);
 process.exitCode=1;
}finally{
 await pool.end();
}
