import {pool,transaction} from '../src/db.js';

const storeName='Chizzyboi Stores';
const foodStoreName='Chizzyboi Food';
const products=[
 ['White Bread','Bakery',145,'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=75'],
 ['Fresh Milk 1L','Dairy',180,'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=600&q=75'],
 ['Rice 2kg','Pantry',350,'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=75'],
 ['Cooking Oil 2L','Pantry',480,'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=600&q=75'],
 ['Eggs 30 Pack','Dairy',650,'https://images.unsplash.com/photo-1518569656558-1f25e69d93d7?auto=format&fit=crop&w=600&q=75'],
 ['Apples 1kg','Produce',280,'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=75'],
 ['Cola 2L','Beverages',220,'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=600&q=75'],
 ['Bottled Water 500ml','Beverages',80,'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=75'],
 ['Tomatoes 1kg','Produce',200,'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=600&q=75'],
 ['Chicken Portions 1kg','Meat',750,'https://images.unsplash.com/photo-1604503468506-a8da13d82791?auto=format&fit=crop&w=600&q=75']
];
const meals=[
 ['Traditional Sadza & Beef','Main Meals',650,'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=75'],
 ['Chicken & Chips','Main Meals',700,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&q=75'],
 ['Chicken Rice','Main Meals',620,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=600&q=75'],
 ['Beef Burger & Chips','Burgers',580,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75'],
 ['Cheeseburger','Burgers',630,'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=75'],
 ['Beef Stew with Sadza','Main Meals',680,'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&q=75'],
 ['Chicken Tikka Wrap','Wraps',550,'https://images.unsplash.com/photo-1626700051175-6818013e1d4f?auto=format&fit=crop&w=600&q=75'],
 ['Vegetable Rice Bowl','Vegetarian',500,'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=75'],
 ['Fish & Chips','Main Meals',750,'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=75'],
 ['Chocolate Cake Slice','Desserts',280,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=75']
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
 for(const [productName,category,priceCents,image] of starterProducts){
  const existing=await c.query('SELECT id,image FROM products WHERE business_id=$1 AND name=$2 LIMIT 1',[store.id,productName]);
  let product=existing.rows[0];
  if(!product){
   product=(await c.query("INSERT INTO products(business_id,name,category,price_cents,image,variants,active) VALUES($1,$2,$3,$4,$5,'[{\"id\":\"default\",\"name\":\"Standard\"}]',true) RETURNING id",[store.id,productName,category,priceCents,image])).rows[0];
  }else if(!product.image){
   await c.query('UPDATE products SET image=$1 WHERE id=$2 AND business_id=$3',[image,product.id,store.id]);
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
