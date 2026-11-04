/** Small fixed-window limiter per client IP. Behind the Caddy proxy `req.ip` is the real client (trust proxy is set). */
export function rateLimit({windowMs=60000,max=300,message='Too many requests. Please slow down.'}={}){
 const hits=new Map();
 setInterval(()=>{const now=Date.now();for(const [k,v] of hits)if(now-v.start>windowMs)hits.delete(k)},windowMs).unref();
 return(req,res,next)=>{
  const now=Date.now();const k=req.ip;let h=hits.get(k);
  if(!h||now-h.start>windowMs){h={start:now,count:0};hits.set(k,h)}
  h.count++;
  res.setHeader('RateLimit-Limit',String(max));res.setHeader('RateLimit-Remaining',String(Math.max(0,max-h.count)));
  if(h.count>max){res.setHeader('Retry-After',String(Math.ceil((h.start+windowMs-now)/1000)));return res.status(429).json({error:message})}
  next()
 }
}
