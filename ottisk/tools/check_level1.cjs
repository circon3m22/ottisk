const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.join(__dirname,'../dist'),context=vm.createContext({Math,console});
vm.runInContext(['levels.js','terrain.js','physics.js','tutorial.js'].map(file=>fs.readFileSync(path.join(root,file),'utf8')).join('\n'),context);
const p=vm.runInContext('({Drop,InkDrop,Counterweight,FirstImprint,spawn,passage,barriers,heightMap,topoLayout,stepTime,railPoint,railLength})',context);
let body=new p.Drop(p.spawn.x,p.spawn.y),weight=new p.Counterweight(),lesson=new p.FirstImprint(),reveals=0;
function tick(target){const x=body.x,y=body.y;body.advance(target,weight);const event=lesson.advance(body,weight,Math.hypot(body.x-x,body.y-y),target);if(event.reveal)reveals++;}
function go(x,y){
  for(let i=0;i<1500&&Math.hypot(body.x-x,body.y-y)>6;i++)tick({x,y});
  assert(Math.hypot(body.x-x,body.y-y)<12,`Route blocked towards ${x},${y}, at ${body.x},${body.y}`);
}
assert.equal(lesson.stage,'move');
for(const point of [...p.heightMap.guides,[300,1530],[300,1640]])go(...point);
assert.equal(lesson.stage,'block');assert.equal(reveals,0);
console.log('PASS: blank-paper movement lesson and the complete introductory maze.');
for(let i=0;i<600;i++)tick({x:600,y:1640});
assert.equal(weight.position,0,'The empty mouse must not move the weight.');
assert.equal(reveals,1,'The mass hint appears once after a real failed push.');
assert.equal(lesson.stage,'ink');
console.log('PASS: movement, failed push, contextual ink prompt.');
for(const [x,y] of p.topoLayout.inkSources){assert(p.heightMap.sample(x,y)<-10,'Ink must be reachable on low terrain.');assert(Math.hypot(x-weight.x,y-weight.y)>220,'Ink must be scattered away from the initial weight.');}
console.log('PASS: preplaced ink sources are accessible and far from the weight.');
const pools=Array.from({length:3},(_,i)=>new p.InkDrop(body.x-10,body.y+i*2,i,.24));
for(let i=0;i<240;i++){for(const pool of pools)pool.advance(body,true);tick({x:body.x,y:body.y});}
assert(Math.abs(body.ink-.72)<.001,'Absorption must conserve the available ink.');
assert.equal(lesson.stage,'push');
console.log('PASS: ink collection and sufficient-mass prompt.');
for(let i=0;i<3600&&!weight.seated;i++){
 const t=p.railPoint(weight.position);tick({x:weight.x+t.tx*100,y:weight.y+t.ty*100});
}
assert(weight.seated,`Heavy mouse failed to seat the weight at ${weight.position.toFixed(2)} / ${p.railLength}, body ${body.x},${body.y}.`);
console.log('PASS: the heavy mouse pushes the circular weight through the curved rail.');
p.barriers.length=0;
p.heightMap.opening=1;
body=new p.Drop(p.passage.x,p.passage.top-70);body.ink=.72;
for(let i=0;i<720;i++)body.advance({x:p.passage.x,y:p.passage.bottom+90},null);
assert(body.y<p.passage.bottom,`The large mouse slipped through at ${body.y}.`);
console.log('PASS: the large mouse cannot enter the narrow passage.');
body.ink=0;
for(let i=0;i<1200&&body.y<p.passage.bottom+60;i++)body.advance({x:p.passage.x,y:p.passage.bottom+90},null);
assert(body.y>p.passage.bottom+50,`The small mouse could not pass: ${body.x},${body.y}.`);
console.log('PASS: after shedding, the small mouse passes the gap.');
for(const aimX of [540,680]){
  body=new p.Drop(p.passage.x,p.passage.top-70,.15);
  for(let i=0;i<850;i++)body.advance({x:aimX,y:p.passage.bottom+85},null);
  assert(body.y>p.passage.bottom+40,`The reduced mouse must slide along the visible bank towards ${aimX}.`);
}
console.log('PASS: a partly filled mouse slides along either bank without a hidden barrier.');
const a=new p.InkDrop(200,350,0,.15),b=new p.InkDrop(218,350,1,.12);
a.absorbDrop(b);assert(Math.abs(a.amount-.27)<1e-9);assert.equal(b.amount,0);
body=new p.Drop(a.x,a.y);
for(let i=0;i<300;i++)a.advance(body,true);
assert(body.ink>.26,'Released and merged ink must remain collectible.');
console.log('PASS: merged ink remains collectible and conserves mass.');
