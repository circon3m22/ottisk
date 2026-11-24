'use strict';
const canvas=document.querySelector('#room'), ctx=canvas.getContext('2d');
const objective=document.querySelector('#objective'),hint=document.querySelector('#hint');
const completion=document.querySelector('#completion');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const paper='#eeeae0', ink='#242721', rust='#b94b32';
const sound=new GameSound(document.querySelector('#sound'));
let marks=[],flowTime=null,flowEnded=false,onPlateBefore=false,impactWait=0;
let inkPools=[],shedding=false,shedTime=0,shedAmount=0,inkSoundWait=0;
const tilt=.84;
let width,height,dpr,baseScale, camera, drop,weight,target, pointer=null, unlocked=false, solved=false, opening=0;
let elapsed=0,prev=0,lag=0,started=false,touchId=null;
let tutorial,gateOpening=0;
const keys=new Set();
const terrain=document.createElement('canvas');
const texScale=1.6, margin=240;
terrain.width=(worldSize.width+2*margin)*texScale;terrain.height=(worldSize.height+2*margin)*texScale;
const map=terrain.getContext('2d');
map.setTransform(texScale,0,0,texScale,margin*texScale,margin*texScale);
let seed=84135;
function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function loop(context,pts,ox=0,oy=0){
  context.beginPath();pts.forEach(([x,y],i)=>i?context.lineTo(x+ox,y+oy):context.moveTo(x+ox,y+oy));context.closePath();
}
function oval(c,x,y,a,b,fill){
  c.beginPath();c.ellipse(x,y,a,b,0,0,TAU);c.fillStyle=fill;c.fill();
}
function contours(r,idx){
  const vs=r.vertices, mx=(r.left+r.right)/2,my=(r.top+r.bottom)/2;
  const height=[22,28,15,23,24,30,18][idx%7];
  // Offset silhouettes form the shaded cuts beneath each engraved surface.
  for(let k=14;k>0;k--){
    loop(map,vs,k*1.6,k*.96);map.fillStyle='rgba(59,55,42,.024)';map.fill();
  }
  for(let k=0;k<=height;k++){
    loop(map,vs,0,-k);map.fillStyle=k===height?'#c5c5b1':k%4===0?'#797e6c':'#929782';map.fill();
  }
  map.save();loop(map,vs,0,-height);map.clip();
  const topColors=['#c5c6ad','#c2c5af','#cccbb5','#bfc2ad','#c7c8b1','#bec2ac','#c8c9b5'];
  map.fillStyle=topColors[idx%7];map.fillRect(r.left-2,r.top-height-2,r.right-r.left+4,r.bottom-r.top+4);
  // Off-centre nested strata, individually warped like the lines of a relief print.
  const tx=mx+(idx%2?-.18:.17)*(r.right-r.left),ty=my-.12*(r.bottom-r.top);
  for(let line=0;line<35;line++){
    const s=1.27-line*.037;
    if(s<=0)continue;
    const points=vs.map(([x,y],j)=>{
      const a=j/vs.length*TAU;
      const wave=Math.sin(a*3+idx+line*.085)*1.8+Math.sin(a*5+idx*.9-line*.08)*1.4;
      const warp=1+.09*Math.sin(a*2+idx+.6*line/35)*(1-s);
      return [tx+(x-tx)*s*warp+Math.cos(a)*wave,ty+(y-ty)*s+Math.sin(a)*wave-height];
    });
    loop(map,points);map.lineWidth=line%6===0?1.35:.68;
    map.strokeStyle=line%6===0?'#5c6656':'#77816c';map.stroke();
  }
  for(let k=0;k<(r.right-r.left)*(r.bottom-r.top)/22;k++){
    const x=r.left+rand()*(r.right-r.left),y=r.top-height+rand()*(r.bottom-r.top);
    map.fillStyle=rand()>.45?'rgba(50,55,38,.14)':'rgba(255,255,237,.35)';map.fillRect(x,y,rand()*1.6+.2,.65);
  }
  map.restore();loop(map,vs,0,-height);map.strokeStyle='#77816c';map.lineWidth=1;map.stroke();
}
function traceWire(c){
  c.beginPath();c.moveTo(plate.x,plate.y);c.bezierCurveTo(440,2560,910,2538,910,2660);
  c.bezierCurveTo(910,2840,660,2820,660,3010);c.bezierCurveTo(660,3135,740,well.y,well.x,well.y);
}
function railPath(c){
  c.beginPath();c.moveTo(railStart.x,railStart.y);c.lineTo(socket.x-turnRadius,railStart.y);
  c.quadraticCurveTo(socket.x,railStart.y,socket.x,railStart.y+railSign*turnRadius);c.lineTo(socket.x,socket.y);
}
function socketWire(c){
  c.beginPath();c.moveTo(socket.x,socket.y);c.bezierCurveTo(850,1980,passage.x,1970,passage.x,passage.top+8);
}
function drawTerrain(){
  map.fillStyle=paper;map.fillRect(-margin,-margin,worldSize.width+2*margin,worldSize.height+2*margin);
  for(let i=0;i<195000;i++){
    const x=rand()*(worldSize.width+2*margin)-margin,y=rand()*(worldSize.height+2*margin)-margin;
    map.fillStyle=i%4?'rgba(77,68,47,.09)':'rgba(255,255,255,.47)';
    map.fillRect(x,y,.4+rand()*1.55,.48+rand()*.85);
  }
  // Sparse flecks and small combs of sediment make the floor legible while moving.
  map.lineWidth=.72;
  for(let i=0;i<680;i++){
    const x=rand()*1220,y=rand()*3260,n=2+Math.floor(rand()*5);
    map.strokeStyle='rgba(97,98,78,.24)';map.beginPath();
    for(let j=0;j<n;j++){
      const u=x+j*1.9,v=y+rand()*2;map.moveTo(u,v);map.lineTo(u+2+rand()*3,v-1-rand()*2);
    }map.stroke();
  }
  map.save();map.setLineDash([1,7]);map.strokeStyle='#aaa898';map.lineWidth=.9;
  map.strokeRect(limits.left,limits.top,limits.right-limits.left,limits.bottom-limits.top);map.restore();
  socketWire(map);map.strokeStyle='#aaa699';map.lineWidth=1.4;map.stroke();
  traceWire(map);map.strokeStyle='#a9a596';map.lineWidth=2.2;map.stroke();
  traceWire(map);map.strokeStyle='#dbd6c8';map.lineWidth=1;map.stroke();
  railPath(map);map.lineWidth=15;map.lineJoin='round';map.lineCap='round';
  map.strokeStyle='#bcb7a6';map.stroke();railPath(map);map.strokeStyle='#726e60';map.lineWidth=6;map.stroke();
  railPath(map);map.strokeStyle='#d6d1bc';map.lineWidth=2;map.stroke();
  map.strokeStyle='#88806e';map.lineWidth=1.5;
  for(let s=16;s<railLength-10;s+=21){
    const p=railPoint(s),nx=-p.ty,ny=p.tx;
    map.beginPath();map.moveTo(p.x-nx*6,p.y-ny*6);map.lineTo(p.x+nx*6,p.y+ny*6);map.stroke();
  }
  rocks.forEach(contours);
}
function reset(){
  if(completion.open)completion.close();
  sound.silence();marks=[];flowTime=null;flowEnded=false;onPlateBefore=false;impactWait=0;
  shedding=false;shedTime=0;shedAmount=0;inkSoundWait=0;
  inkPools=[];tutorial=new FirstImprint();gateOpening=0;barriers.length=0;barriers.push(gateBarrier);
  drop=new Drop(spawn.x,spawn.y);weight=new Counterweight();target={x:drop.x,y:drop.y};pointer=null;
  camera={x:spawn.x,y:245,zoom:1.52};keys.clear();started=false;unlocked=false;solved=false;opening=0;touchId=null;
  objective.textContent=tutorial.message;
  hint.textContent=matchMedia('(pointer: coarse)').matches?'Коснитесь бумаги':'Можно двигаться стрелками';
}
function size(){
  width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  baseScale=Math.min(width/(width/height<.9?665:1330),height/(830*tilt));
}
function pointerMove(e){
  started=true;const s=baseScale*camera.zoom;
  pointer={x:e.clientX,y:e.clientY,worldX:camera.x+(e.clientX-width/2)/s,worldY:camera.y+(e.clientY-height/2)/(s*tilt)};
}
canvas.addEventListener('pointermove',e=>{
  if(e.pointerType!=='touch'||e.pointerId===touchId)pointerMove(e);
});
canvas.addEventListener('pointerdown',e=>{
  sound.activate();
  if(e.button!==0)return;
  if(touchId!==null)return;
  shedding=true;
  canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);touchId=e.pointerId;pointerMove(e);
});
function stopPointer(){pointer=null;target={x:drop.x,y:drop.y};}
canvas.addEventListener('pointerleave',e=>{if(!canvas.hasPointerCapture(e.pointerId))stopPointer();});
function release(e){if(e.pointerId!==touchId)return;touchId=null;shedding=false;if(e.pointerType==='touch'||e.type==='pointercancel')stopPointer();}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
canvas.addEventListener('lostpointercapture',()=>{touchId=null;shedding=false;});
function replay(){sound.activate();reset();canvas.focus({preventScroll:true});}
document.querySelector('#reset').onclick=replay;
document.querySelector('#replay').onclick=replay;
completion.addEventListener('cancel',e=>{e.preventDefault();replay();});
window.addEventListener('keydown',e=>{
  if(e.code==='KeyR'||e.key.startsWith('Arrow'))sound.activate();
  if(e.code==='KeyR'){replay();return;}
  if(completion.open)return;
  if(e.code==='Space'){e.preventDefault();shedding=true;sound.activate();return;}
  if(!e.key.startsWith('Arrow'))return;
  e.preventDefault();pointer=null;started=true;keys.add(e.key);
});
window.addEventListener('keyup',e=>{if(e.code==='Space')shedding=false;if(keys.delete(e.key)&&!keys.size)stopPointer();});
window.addEventListener('blur',()=>{keys.clear();shedding=false;stopPointer();sound.silence();});
document.addEventListener('visibilitychange',()=>{prev=0;lag=0;if(document.hidden){shedding=false;sound.silence();}});
function updateInk(){
  inkSoundWait=Math.max(0,inkSoundWait-stepTime);
  drop.absorbing=0;drop.shedding=shedding&&drop.ink>0;
  if(shedding && drop.ink>0){
    const amount=Math.min(drop.ink,.29*stepTime);
    drop.ink-=amount;
    const x=drop.x-Math.cos(drop.heading)*drop.bodyRadius*.66;
    const y=drop.y-Math.sin(drop.heading)*drop.bodyRadius*.66;
    shedAmount+=amount;
    shedTime+=stepTime;
    if(shedTime>.12||drop.ink<=0){
      const pool=new InkDrop(x,y,Math.random()*TAU,shedAmount);
      pool.vx=drop.vx*.22-Math.cos(drop.heading)*20;
      pool.vy=drop.vy*.22-Math.sin(drop.heading)*20;
      inkPools.push(pool);shedAmount=0;shedTime=0;sound.play('inkOut');
    }
  }else if(shedAmount>0){
    inkPools.push(new InkDrop(drop.x,drop.y,Math.random()*TAU,shedAmount));
    shedAmount=0;shedTime=0;
  }
  for(const pool of inkPools){
    if(pool.advance(drop,!shedding)){
      if(!inkSoundWait){sound.play('inkIn');inkSoundWait=.2;}
    }
  }
  for(let i=0;i<inkPools.length;i++){
    const a=inkPools[i];
    if(a.amount<=0)continue;
    for(let j=i+1;j<inkPools.length;j++){
      a.cohereWith(inkPools[j]);
    }
  }
  inkPools=inkPools.filter(p=>p.amount>0);
}
function drawInk(){
  for(const pool of inkPools){
    const r=Math.sqrt(pool.amount)*25,points=pool.nodes;
    oval(ctx,pool.x+1,pool.y+3,r*.95,r*.68,'rgba(35,36,28,.13)');
    ctx.save();ctx.translate(0,-3);
    ctx.beginPath();const last=points.at(-1);
    ctx.moveTo((last.x+points[0].x)/2,(last.y+points[0].y)/2);
    points.forEach((p,i)=>{const q=points[(i+1)%points.length];ctx.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);});
    ctx.closePath();
    const shine=ctx.createRadialGradient(pool.x-r*.28,pool.y-r*.35,r*.03,pool.x,pool.y,r*1.2);
    shine.addColorStop(0,'#465144');shine.addColorStop(.28,'#222b22');shine.addColorStop(.8,'#101710');
    ctx.fillStyle=shine;ctx.fill();ctx.clip();
    const scale=Math.sqrt(pool.amount/pool.lobes.reduce((n,p)=>n+p.amount,0));
    for(const lobe of pool.lobes.slice(0,4)){
      const size=Math.sqrt(lobe.amount)*25*scale;
      oval(ctx,pool.x+lobe.x*scale-size*.28,pool.y+lobe.y*scale-size*.33,
        size*.22,Math.max(.01,size*.06),'#899780');
    }
    ctx.restore();
  }
}
function ripple(x,y,r,color){
  if(!reduced.matches)marks.push({x,y,r,color,age:0,life:.52});
}
function grit(x,y,n,nx,ny){
  if(reduced.matches)return;
  for(let i=0;i<n;i++){
    marks.push({x:x+(Math.random()-.5)*5,y:y+(Math.random()-.5)*5,
      vx:nx*21+(Math.random()-.5)*42,vy:ny*21+(Math.random()-.5)*42,
      color:'#807962',age:0,life:.19+Math.random()*.16});
  }
}
function drawMarks(){
  ctx.save();
  for(const m of marks){
    const t=m.age/m.life;ctx.globalAlpha=(1-t)*.65;
    ctx.strokeStyle=m.color;ctx.lineWidth=m.r?1.6:1.2;ctx.beginPath();
    if(m.r)ctx.ellipse(m.x,m.y,m.r+20*t,m.r+17*t,0,0,TAU);
    else{const x=m.x+m.vx*m.age,y=m.y+m.vy*m.age;ctx.moveTo(x,y);ctx.lineTo(x+m.vx*.06,y+m.vy*.06);}
    ctx.stroke();
  }
  ctx.restore();
}
function advanceFlow(seconds){
    flowTime=Math.min(1,flowTime+seconds/(reduced.matches?.16:.4));
    if(!flowEnded && flowTime>=.88){flowEnded=true;sound.play('flowEnd');ripple(well.x,well.y,28,rust);}
    if(flowTime>=1){
      solved=true;keys.clear();hint.textContent='';objective.textContent='';
      completion.showModal();
    }
}
function update(){
  for(const m of marks)m.age+=stepTime;
  if(marks.length)marks=marks.filter(m=>m.age<m.life);
  if(solved||flowTime!==null)return;
  barriers.length=0;if(gateOpening<.9)barriers.push(gateBarrier);
  updateInk();
  const scale=baseScale*camera.zoom;
  if(pointer){
    target.x=pointer.worldX;target.y=pointer.worldY;
  }else if(keys.size){
    target.x=drop.x+100*(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')));
    target.y=drop.y+100*(Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')));
  }
  target.x=clamp(target.x,limits.left+3,limits.right-3);target.y=clamp(target.y,limits.top+3,limits.bottom-3);
  const lastStride=drop.stride,wasSeated=weight.seated,oldX=drop.x,oldY=drop.y;
  drop.advance(target,weight);
  const event=tutorial.advance(drop,weight,Math.hypot(drop.x-oldX,drop.y-oldY),target);
  if(event.reveal){
    inkPools=[[290,1590],[210,1820],[620,1810],[980,1670]].map(([x,y],i)=>new InkDrop(x,y,i*1.8,.24));
    sound.play('inkOut');
  }
  const speed=Math.hypot(drop.vx,drop.vy), portrait=width/height<.9;
  if(Math.floor(lastStride/TAU)!==Math.floor(drop.stride/TAU) && drop.effort>.17){
    sound.play('step',drop.effort);
    const rear=drop.tail.points[0],dx=Math.cos(drop.heading),dy=Math.sin(drop.heading);
    grit(rear.x-3*dx,rear.y-3*dy,2,-dx,-dy);
  }
  impactWait=Math.max(0,impactWait-stepTime);
  if(drop.impact && !impactWait){
    const h=drop.impact;sound.play('bump',clamp(h.speed/310,.22,1));grit(h.x,h.y,6,h.nx,h.ny);impactWait=.22;
  }
  if(!wasSeated && weight.seated){sound.play('seat');sound.play('open');ripple(socket.x,socket.y,41,rust);}
  if(weight.seated)gateOpening=Math.min(1,gateOpening+stepTime*1.25);
  const approach=(value,goal,rate)=>value+(goal-value)*(1-Math.exp(-rate*stepTime));
  const follow=portrait?.94:.49;
  const focusX=started?610+(drop.x-610)*follow:spawn.x,focusY=started?clamp(drop.y+135,245,limits.bottom-200):245;
  camera.x=approach(camera.x,focusX,2.7);camera.y=approach(camera.y,focusY,2.7);
  const zoom=!started?1.52:reduced.matches?1.15:1.26-.32*clamp(speed/360,0,1);
  camera.zoom=approach(camera.zoom,zoom,1.65);
  const onPlate=Math.hypot(drop.x-plate.x,drop.y-plate.y)<33;
  if(onPlate&&!onPlateBefore&&!unlocked){sound.play('plate');ripple(plate.x,plate.y,21,rust);}
  onPlateBefore=onPlate;
  if(!unlocked&&weight.seated && onPlate){unlocked=true;sound.play('open');ripple(well.x,well.y,38,'#777963');}
  if(unlocked)opening=Math.min(1,opening+stepTime*1.25);
  if(unlocked)tutorial.stage='exit';
  let instruction=tutorial.message;
  if(weight.seated&&tutorial.stage==='passage')instruction='Найдите узкий проход к нижней кнопке';
  if(objective.textContent!==instruction)objective.textContent=instruction;
  const control=tutorial.stage==='shed'?(matchMedia('(pointer: coarse)').matches?'Удерживайте касание':'Удерживайте ЛКМ или пробел'):tutorial.stage==='move'?'Можно двигаться стрелками':'';
  if(hint.textContent!==control)hint.textContent=control;
  if(opening>=1 && Math.hypot(drop.x-well.x,drop.y-well.y)<46){
    flowTime=0;keys.clear();shedding=false;stopPointer();hint.textContent='';
    sound.play('flowIn');
  }
  elapsed+=stepTime;
}
function devices(){
  if(gateOpening<1){
    const y=passage.top+8,x=passage.x-gateOpening*67;
    ctx.save();ctx.beginPath();ctx.rect(passage.left-1,y-10,54,17);ctx.clip();
    ctx.fillStyle='#a3a591';ctx.fillRect(x-28,y-5,56,9);
    ctx.strokeStyle='#747b66';ctx.lineWidth=1;ctx.strokeRect(x-28,y-5,56,9);
    ctx.strokeStyle='#d4d2bd';ctx.beginPath();ctx.moveTo(x-24,y-3);ctx.lineTo(x+24,y-3);ctx.stroke();ctx.restore();
  }
  const {x,y}=plate;
  const onPlate=unlocked||Math.hypot(drop.x-x,drop.y-y)<33;
  const {x:sx,y:sy}=socket;
  oval(ctx,sx+2,sy+3,45,45,'#aaa590');oval(ctx,sx,sy,45,45,'#747867');oval(ctx,sx,sy,41,41,'#d7cfb7');
  oval(ctx,sx,sy,36,36,'#a8573e');oval(ctx,sx,sy,32,32,'#c1b39c');
  // Matching rings on the roller and socket identify the mating parts.
  ctx.beginPath();ctx.arc(sx,sy,13,0,TAU);ctx.strokeStyle='#914930';ctx.lineWidth=3;ctx.stroke();
  if(weight.seated){
    // Paint the exposed lead; the raised rail continues to sit above it.
    ctx.save();socketWire(ctx);ctx.lineWidth=1.4;ctx.strokeStyle=rust;ctx.stroke();ctx.restore();
    ctx.beginPath();ctx.arc(sx,sy,42,0,TAU);ctx.strokeStyle=rust;ctx.lineWidth=4;ctx.stroke();
  }
  if(opening>0){
    ctx.save();traceWire(ctx);ctx.strokeStyle=rust;ctx.lineWidth=1.6;ctx.setLineDash([820*opening,900]);ctx.stroke();ctx.restore();
  }
  oval(ctx,x+3,y+5,24,22,'#999584');oval(ctx,x,y,24,22,'#63675a');
  oval(ctx,x,y-(onPlate?0:4),21,19,onPlate?'#94412d':'#c85d40');
  ctx.strokeStyle='#f1c6a4';ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(x,y-(onPlate?0:4),13,0,TAU);ctx.stroke();
  const wx=well.x,wy=well.y;
  oval(ctx,wx+4,wy+6,39,34,'#c1bdad');oval(ctx,wx,wy,39,34,'#737969');
  oval(ctx,wx,wy-2,36,31,'#c5c7b4');oval(ctx,wx,wy-2,29,25,'#252a24');
  ctx.save();ctx.beginPath();ctx.ellipse(wx,wy-2,29,25,0,0,TAU);ctx.clip();
  for(let i=-4;i<=4;i++){
    const offset=Math.sign(i||1)*opening*44;
    ctx.fillStyle=i%2?'#989e89':'#a9ae99';ctx.fillRect(wx+i*9-4+offset,wy-34,8,69);
  }ctx.restore();
}
function drawWeight(){
  const {x,y,radius:r,position}=weight;
  oval(ctx,x+4,y+5,r+2,r,'#b6b09f');
  oval(ctx,x,y,r,r,'#6f4636');oval(ctx,x,y-5,r,r,'#9f5b40');oval(ctx,x,y-10,r,r,'#c48760');
  ctx.save();ctx.translate(x,y-10);ctx.rotate(position/65);
  ctx.strokeStyle='#86583f';ctx.lineWidth=1.1;
  for(const ring of [15,26,31]){ctx.beginPath();ctx.arc(0,0,ring,0,TAU);ctx.stroke();}
  for(let i=0;i<12;i++){
    ctx.rotate(TAU/12);ctx.beginPath();ctx.moveTo(26,0);ctx.lineTo(31,0);ctx.stroke();
  }
  oval(ctx,0,0,8,8,'#795440');oval(ctx,0,-1,5,5,'#c8a582');ctx.restore();
}
function tailOutline(points,height){
  const left=[],right=[];
  for(let i=0;i<points.length;i++){
    const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(i+1,points.length-1)];
    const dx=after.x-before.x,dy=after.y-before.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy*p.width/len,ny=dx*p.width/len;
    // The base rises with the body while the tip skims the floor.
    const y=p.y-height*(1-i/(points.length-1))**2;
    left.push([p.x+nx,y+ny]);right.push([p.x-nx,y-ny]);
  }
  const rim=left.concat(right.reverse()), path=new Path2D();
  const last=rim[rim.length-1];
  path.moveTo((last[0]+rim[0][0])/2,(last[1]+rim[0][1])/2);
  rim.forEach(([x,y],i)=>{
    const next=rim[(i+1)%rim.length];
    path.quadraticCurveTo(x,y,(x+next[0])/2,(y+next[1])/2);
  });
  path.closePath();return path;
}
function flowPoint(p,time,delay=0){
  const t=clamp(time-delay*(1-time),0,1);
  const dx=well.x-drop.x,dy=well.y-drop.y,distance=Math.hypot(dx,dy)||1;
  const front=clamp(((p.x-drop.x)*dx+(p.y-drop.y)*dy)/(distance*drop.bodyRadius),-1,1);
  // The leading surface enters first. The trailing membrane stays on the
  // floor and narrows into the inlet, with no change in elevation.
  const local=clamp(t+.24*front*Math.sin(Math.PI*t),0,1),ease=local*local*(3-2*local);
  const momentum=.15*t*(1-t)*(1-t);
  return {x:p.x+(well.x-p.x)*ease+drop.vx*momentum,
    y:p.y+(well.y-p.y)*ease+drop.vy*momentum};
}
function drawDrop(){
  if(solved)return;
  const {nodes:ns,x,y,heading}=drop;
  const flowing=flowTime!==null,t=flowing?flowTime:0;
  const body=flowing?ns.map(p=>flowPoint(p,t)):ns;
  ctx.save();
  const outline=new Path2D(), end=body[body.length-1];
  outline.moveTo((end.x+body[0].x)/2,(end.y+body[0].y)/2);
  body.forEach((p,i)=>{
    const q=body[(i+1)%body.length];
    outline.quadraticCurveTo(p.x,p.y,(p.x+q.x)/2,(p.y+q.y)/2);
  });
  outline.closePath();
  const lift=flowing||reduced.matches?0:drop.effort*3.8*(.5+.5*Math.sin(drop.stride-.7));
  const tail=flowing?drop.tail.points.map((p,i,points)=>{
    const delay=i/(points.length-1)*.12;
    return {...flowPoint(p,t,delay),width:p.width*(1-t*t)};
  }):drop.tail.points;
  if(!flowing){
    ctx.save();ctx.translate(1.5,2);ctx.fillStyle='rgba(43,39,26,.12)';
    ctx.fill(tailOutline(tail,0));ctx.restore();
  }
  ctx.save();ctx.translate(3,4);ctx.globalAlpha=1-t;
  ctx.fillStyle='rgba(43,39,26,.12)';ctx.fill(outline);ctx.restore();
  ctx.fillStyle='#121511';ctx.fill(tailOutline(tail,(6+lift)*(1-t)));
  ctx.translate(0,-(6+lift)*(1-t));ctx.fillStyle='#121511';ctx.fill(outline);
  const dirX=Math.cos(heading),dirY=Math.sin(heading);
  let faceX=0,faceY=0,weightSum=0,side=0;
  for(const p of ns){
    // Anchor the eyes to the moving front arc, including its lateral lean.
    const weight=Math.max(0,p.dx*dirX+p.dy*dirY)**3;
    faceX+=(p.x-x)*weight;faceY+=(p.y-y)*weight;weightSum+=weight;
    side=Math.max(side,Math.abs(-(p.x-x)*dirY+(p.y-y)*dirX));
  }
  const spacing=Math.min(8,side*.37);
  faceX=x+.48*faceX/weightSum;faceY=y+.48*faceY/weightSum;
  const blink=reduced.matches?1:1-.91*Math.max(0,1-Math.abs((elapsed%5.7)-4.1)/.095);
  for(const sign of [-1,1]){
    const eye={x:faceX-dirY*spacing*sign,y:faceY+dirX*spacing*sign};
    const pos=flowing?flowPoint(eye,t):eye,size=4.1*(1-t);
    oval(ctx,pos.x,pos.y,size,size/tilt*blink,'#fffdf5');
  }ctx.restore();
}
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);
  const s=baseScale*camera.zoom;
  ctx.translate(width/2,height/2);ctx.scale(s,s*tilt);ctx.translate(-camera.x,-camera.y);
  ctx.drawImage(terrain,-margin,-margin,terrain.width/texScale,terrain.height/texScale);
  drawInk();
  devices();
  drawMarks();
  if(drop.y<weight.y){drawDrop();drawWeight();}else{drawWeight();drawDrop();}
  if(flowTime!==null && flowTime>.67 && !solved){
    // The rim covers the last thin stream as it enters.
    ctx.beginPath();ctx.ellipse(well.x,well.y-2,31,27,0,0,Math.PI);
    ctx.lineWidth=4;ctx.strokeStyle='#c5c7b4';ctx.stroke();
  }
}
function frame(time){
  const seconds=prev?(time-prev)/1000:0;
  const flowing=flowTime!==null&&!solved;
  lag+=Math.min(seconds,.05);
  prev=time;
  while(lag>=stepTime){update();lag-=stepTime;}
  if(flowing)advanceFlow(seconds);
  sound.rolling(flowTime===null?Math.abs(weight.speed)/150:0);
  draw();requestAnimationFrame(frame);
}
drawTerrain();reset();size();window.addEventListener('resize',size);requestAnimationFrame(frame);
