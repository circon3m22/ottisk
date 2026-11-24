'use strict';
const canvas=document.querySelector('#room'),screenCtx=canvas.getContext('2d');
let ctx=screenCtx;
const objective=document.querySelector('#objective'),hint=document.querySelector('#hint');
const completion=document.querySelector('#completion');
const helpButton=document.querySelector('#help');
let helpShown=false;
function toggleHelp(){helpShown=!helpShown;helpButton?.setAttribute('aria-pressed',String(helpShown));sound.activate();canvas.focus({preventScroll:true});}
if(helpButton)helpButton.onclick=toggleHelp;
const chapterPicker=document.querySelector('#chapter');
if(chapterPicker){chapterPicker.value=levelNumber===1?'index.html':'level'+levelNumber+'.html';chapterPicker.onchange=()=>{location.href=chapterPicker.value;};}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const paper='#eeeae0', ink='#242721', rust='#b94b32';
const sound=new GameSound(document.querySelector('#sound'));
let marks=[],flowTime=null,flowEnded=false,onPlateBefore=false,impactWait=0;
let inkPools=[],shedding=false,shedTime=0,shedAmount=0,inkSoundWait=0;
const tilt=.84;
let width,height,dpr,baseScale, camera, drop,weight,target, pointer=null, unlocked=false, solved=false, opening=0;
let elapsed=0,prev=0,lag=0,started=false,touchId=null;
let contourTime=0;
let tutorial,gateOpening=0;
const keys=new Set();
const terrain=new ContourPainting(heightMap);
const worldFrame=document.createElement('canvas'),worldCtx=worldFrame.getContext('2d');
let activationAge=-1,activationBlend=0,exitRest=0,portalAge=0,flowLift=0,buttonPress=0;
let bypassOpened=false,gateAge=-1,headAge=-1,lowerOpening=0,spool=null,cupLoads=[],sealPress=0;
let mechanisms=null;
function oval(c,x,y,a,b,fill){
  c.beginPath();c.ellipse(x,y,a,b,0,0,TAU);c.fillStyle=fill;c.fill();
}
function traceWire(c){
  traceCurves(c,exitWireCurves);
}
function traceCurves(c,curves){c.beginPath();c.moveTo(...curves[0][0]);for(const p of curves)c.bezierCurveTo(...p[1],...p[2],...p[3]);}
const exitWireCurves=topoLayout.exitWire;
const exitWireLength=exitWireCurves.reduce((sum,points)=>{
  let last=points[0];
  for(let i=1;i<=96;i++){
    const t=i/96,u=1-t,p=[0,0];
    for(let k=0;k<2;k++)p[k]=u*u*u*points[0][k]+3*u*u*t*points[1][k]+3*u*t*t*points[2][k]+t*t*t*points[3][k];
    sum+=Math.hypot(p[0]-last[0],p[1]-last[1]);last=p;
  }
  return sum;
},0);
function exitWireProgress(){return clamp(portalAge/1.15,0,1);}
function railPath(c,rail=mainRail){
  const a=rail.start,b=rail.finish,sign=Math.sign(b.y-a.y)||1;
  c.beginPath();c.moveTo(a.x,a.y);
  if(a.y===b.y){c.lineTo(b.x,b.y);return;}
  c.lineTo(b.x-46,a.y);
  c.quadraticCurveTo(b.x,a.y,b.x,a.y+sign*46);c.lineTo(b.x,b.y);
}
function socketWire(c){
  traceCurves(c,topoLayout.mechanismWire);
}
function drawTerrain(){terrain.prepare();}
function drawFloorPrint(){
  if(levelNumber>=6){mechanisms.drawFloor();return;}
  if(levelNumber>=3){drawCampaignFloor();return;}
  ctx.save();socketWire(ctx);ctx.strokeStyle='#a3a897';ctx.lineWidth=1.3;ctx.stroke();
  traceWire(ctx);ctx.strokeStyle='#a7a794';ctx.lineWidth=1.6;ctx.stroke();
  railPath(ctx);ctx.lineWidth=15;ctx.lineJoin='round';ctx.lineCap='round';ctx.strokeStyle='#bcb7a6';ctx.stroke();
  railPath(ctx);ctx.strokeStyle='#726e60';ctx.lineWidth=6;ctx.stroke();
  railPath(ctx);ctx.strokeStyle='#d6d1bc';ctx.lineWidth=2;ctx.stroke();
  ctx.strokeStyle='#88806e';ctx.lineWidth=1.4;
  for(let s=16;s<railLength-10;s+=21){const p=railPoint(s),nx=-p.ty,ny=p.tx;ctx.beginPath();ctx.moveTo(p.x-nx*6,p.y-ny*6);ctx.lineTo(p.x+nx*6,p.y+ny*6);ctx.stroke();}
  if(spool){
    railPath(ctx,spool.rail);ctx.strokeStyle='#a9afa1';ctx.lineWidth=10;ctx.stroke();
    railPath(ctx,spool.rail);ctx.strokeStyle='#737e73';ctx.lineWidth=3;ctx.stroke();
    const p=spool.rail.finish;
    oval(ctx,p.x,p.y,31,31,'#d0d4c0');ctx.beginPath();ctx.arc(p.x,p.y,27,0,TAU);ctx.strokeStyle=spool.seated?rust:'#737e73';ctx.lineWidth=1.7;ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.bezierCurveTo(860,1100,650,1000,plate.x,plate.y);
    ctx.strokeStyle=spool.seated?rust:'#9aa58e';ctx.lineWidth=1.3;ctx.stroke();
    const start=spool.rail.start;
    ctx.beginPath();ctx.arc(start.x,start.y,28,0,TAU);ctx.strokeStyle=spool.atStart?rust:'#737e73';ctx.lineWidth=1.7;ctx.stroke();
    ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.bezierCurveTo(405,1320,490,1420,railStart.x,railStart.y);ctx.strokeStyle=spool.atStart?rust:'#9aa58e';ctx.lineWidth=1.3;ctx.stroke();
    traceCurves(ctx,topoLayout.latchWire);ctx.strokeStyle=weight.seated&&spool.atStart?rust:'#a7a794';ctx.lineWidth=1.4;ctx.stroke();
  }
  ctx.restore();
}
function reset(){
  if(completion.open)completion.close();
  sound.silence();marks=[];flowTime=null;flowEnded=false;onPlateBefore=false;impactWait=0;
  shedding=false;shedTime=0;shedAmount=0;inkSoundWait=0;
  elapsed=0;contourTime=0;heightMap.warp.update(null);
  helpShown=false;helpButton?.setAttribute('aria-pressed','false');
  inkPools=topoLayout.inkSources.map(([x,y],i)=>new InkDrop(x,y,i*1.8,.24));
  mechanisms=levelNumber>=6?new laterChapters[levelNumber]():levelNumber>=3?new PrintMechanisms():null;
  tutorial=levelNumber>=3?new PrintedLesson():levelNumber===2?new EyeletLesson():new FirstImprint();gateOpening=0;heightMap.opening=0;barriers.length=0;activationAge=-1;activationBlend=0;exitRest=0;portalAge=0;buttonPress=0;flowLift=0;
  bypassOpened=false;gateAge=-1;headAge=-1;lowerOpening=0;heightMap.secondaryOpening=0;cupLoads=[0,0];sealPress=0;
  spool=topoLayout.spool?new Counterweight({rail:createRail(topoLayout.spool.start,topoLayout.spool.socket),minimumInk:0,radius:23,lockAtEnd:false}):null;
  drop=new Drop(spawn.x,spawn.y,topoLayout.initialInk);
  weight=new Counterweight(levelNumber===6?{minimumInk:.36,lockAtEnd:false}:undefined);
  target={x:drop.x,y:drop.y};pointer=null;
  camera={x:spawn.x,y:spawn.y+55,zoom:1.52};keys.clear();started=false;unlocked=false;solved=false;opening=0;touchId=null;
  objective.textContent=tutorial.goal||tutorial.message;
  hint.textContent=matchMedia('(pointer: coarse)').matches?'Коснитесь бумаги':'Можно двигаться стрелками';
}
function size(){
  width=innerWidth;height=innerHeight;dpr=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  worldFrame.width=canvas.width;worldFrame.height=canvas.height;
  baseScale=Math.min(width/(width/height<.9?665:1330),height/(830*tilt));
}
function pointerMove(e){
  started=true;const s=baseScale*camera.zoom;
  pointer={x:e.clientX,y:e.clientY,worldX:camera.x+(e.clientX-width/2)/s,worldY:camera.y-sheetOffset()+(e.clientY-height/2)/(s*tilt)};
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
  if(['SELECT','BUTTON','A','DIALOG'].includes(e.target?.tagName))return;
  if(e.code==='KeyH'){e.preventDefault();toggleHelp();return;}
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
    let dx=-Math.cos(drop.heading),dy=-Math.sin(drop.heading);
    // An etched recess draws the released liquid towards its centre.
    const receiver=[...(topoLayout.cups||[]),...(topoLayout.circuits||[])].find(p=>Math.hypot(p.x-drop.x,p.y-drop.y)<drop.bodyRadius+24);
    if(receiver){const distance=Math.hypot(receiver.x-drop.x,receiver.y-drop.y)||1;dx=(receiver.x-drop.x)/distance;dy=(receiver.y-drop.y)/distance;}
    const reach=receiver?drop.bodyRadius*.75:drop.bodyRadius+5;
    const x=drop.x+dx*reach,y=drop.y+dy*reach;
    shedAmount+=amount;
    shedTime+=stepTime;
    if(shedTime>.12||drop.ink<=0){
      const pool=new InkDrop(x,y,Math.random()*TAU,shedAmount);
      pool.collectDelay=.45;
      pool.needsSeparation=true;
      pool.vx=drop.vx*.22+dx*20;
      pool.vy=drop.vy*.22+dy*20;
      inkPools.push(pool);shedAmount=0;shedTime=0;sound.play('inkOut');
    }
  }else if(shedAmount>0){
    const pool=new InkDrop(drop.x-Math.cos(drop.heading)*(drop.bodyRadius+5),drop.y-Math.sin(drop.heading)*(drop.bodyRadius+5),Math.random()*TAU,shedAmount);
    pool.collectDelay=.45;pool.needsSeparation=true;inkPools.push(pool);
    shedAmount=0;shedTime=0;
  }
  for(const pool of inkPools){
    pool.inBasin=false;
    for(const cup of [...(topoLayout.cups||[]),...(topoLayout.circuits||[])]){
      if(Math.hypot(pool.x-cup.x,pool.y-cup.y)<59){pool.inBasin=true;pool.vx+=(cup.x-pool.x)*10*stepTime;pool.vy+=(cup.y-pool.y)*10*stepTime;}
    }
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
  cupLoads=(topoLayout.cups||[]).map(cup=>inkPools.reduce((total,pool)=>total+pool.amount*clamp((64-Math.hypot(pool.x-cup.x,pool.y-cup.y))/22,0,1),0));
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
  portalAge+=seconds;
  flowTime=Math.min(1,flowTime+seconds/(reduced.matches?.2:.9));
  const focus=1-Math.exp(-4.3*seconds);
  camera.x+=(well.x-camera.x)*focus;camera.y+=(well.y+sheetOffset()-camera.y)*focus;
  if(!reduced.matches)camera.zoom+=((levelNumber===4?.62:1.42)-camera.zoom)*focus*.65;
  if(!flowEnded&&flowTime>=.82){flowEnded=true;sound.play('flowEnd');ripple(well.x,well.y,34,'#687e72');}
  if(flowTime>=1){
    exitRest+=seconds;
    if(exitRest>(reduced.matches?.05:.24)){
      solved=true;keys.clear();hint.textContent='';objective.textContent='';completion.showModal();
    }
  }
}
function update(){
  for(const m of marks)m.age+=stepTime;
  if(marks.length)marks=marks.filter(m=>m.age<m.life);
  if(!solved){
    contourTime+=stepTime;
    heightMap.warp.update(reduced.matches?null:contourTime);
  }
  if(solved||flowTime!==null)return;
  if(mechanisms?.rewind){
    mechanisms.recover();
    if(objective.textContent!==mechanisms.message)objective.textContent=mechanisms.message;
    elapsed+=stepTime;return;
  }
  barriers.length=0;heightMap.setOpenings(gateOpening,lowerOpening);
  updateInk();
  const scale=baseScale*camera.zoom;
  if(pointer){
    target.x=pointer.worldX;target.y=pointer.worldY;
  }else if(keys.size){
    target.x=drop.x+100*(Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')));
    target.y=drop.y+100*(Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp')));
  }
  target.x=clamp(target.x,limits.left+3,limits.right-3);target.y=clamp(target.y,limits.top+3,limits.bottom-3);
  const lastStride=drop.stride,wasSeated=weight.seated,wasSpoolSeated=spool?.seated,oldX=drop.x,oldY=drop.y;
  drop.advance(target,spool?[weight,spool]:hasWeight()?weight:null);
  mechanisms?.advance();
  const event=tutorial.advance(drop,weight,Math.hypot(drop.x-oldX,drop.y-oldY),target,{bypassOpened,spoolSeated:spool?.seated,spoolAtStart:spool?.atStart,unlocked});
  if(event.reveal)ripple(inkPools[0]?.x||drop.x,inkPools[0]?.y||drop.y,14,'#586c57');
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
  if(!wasSeated&&weight.seated&&levelNumber!==6){activationAge=0;sound.play('seat');sound.play('seal');ripple(socket.x,socket.y,41,rust);}
  if(spool?.seated&&!wasSpoolSeated){sound.play('seat');ripple(spool.x,spool.y,27,rust);}
  if(activationAge>=0){activationAge+=stepTime;activationBlend=1-Math.exp(-activationAge*2.3);}
  if((levelNumber===1&&weight.seated&&activationAge>.65)||(levelNumber===2&&bypassOpened))gateOpening=Math.min(1,gateOpening+stepTime*.65);
  if(levelNumber===2&&weight.seated&&activationAge>.65)lowerOpening=clamp(lowerOpening+(spool.atStart?1:-1)*stepTime*.65,0,1);
  if(gateAge>=0)gateAge+=stepTime;
  if(levelNumber===2&&headAge<0&&tutorial.entered){headAge=0;sound.play('printer');}
  if(headAge>=0)headAge+=stepTime;
  const approach=(value,goal,rate)=>value+(goal-value)*(1-Math.exp(-rate*stepTime));
  const follow=portrait?.94:.49;
  const mid=worldSize.width/2;
  const focusX=started?mid+(drop.x-mid)*follow:spawn.x;
  const minCameraY=levelNumber===1?limits.top+145:spawn.y+55;
  let focusY=started?clamp(drop.y+135,minCameraY,limits.bottom-200):spawn.y+55;
  if(levelNumber===5&&mechanisms.dotFlash>=0&&mechanisms.dotFlash<4)focusY=1335;
  focusY+=sheetOffset();
  camera.x=approach(camera.x,focusX,2.7);camera.y=approach(camera.y,focusY,2.7);
  const zoom=levelNumber===4&&mechanisms.revealAge>=0?.58:levelNumber===5&&mechanisms.dotFlash>=0&&mechanisms.dotFlash<4?.73:!started?1.52:reduced.matches?1.15:1.26-.32*clamp(speed/360,0,1);
  camera.zoom=approach(camera.zoom,zoom,1.65);
  const onPlate=Math.hypot(drop.x-plate.x,drop.y-plate.y)<33;
  const plateLatched=levelNumber===2?bypassOpened:unlocked;
  buttonPress+=(Number(onPlate||plateLatched)-buttonPress)*.08;
  if(onPlate&&!onPlateBefore&&!plateLatched){sound.play('plate');ripple(plate.x,plate.y,21,rust);}
  onPlateBefore=onPlate;
  if(levelNumber===2&&onPlate&&spool.seated&&!bypassOpened){bypassOpened=true;gateAge=0;sound.play('open');ripple(plate.x,plate.y,30,rust);}
  const onSeal=topoLayout.seal&&Math.hypot(drop.x-topoLayout.seal.x,drop.y-topoLayout.seal.y)<33;
  sealPress+=(Number(onSeal||unlocked)-sealPress)*.08;
  const exitContact=levelNumber===2?onSeal&&spool.atStart:onPlate;
  if(levelNumber<=2&&!unlocked&&weight.seated&&exitContact){unlocked=true;portalAge=0;sound.play('portal');const p=topoLayout.seal||plate;ripple(p.x,p.y,30,rust);}
  if(unlocked){portalAge+=stepTime;opening=Math.min(1,opening+stepTime*.85);}
  if(unlocked)tutorial.stage='exit';
  let instruction=helpShown?tutorial.message:(tutorial.goal||tutorial.message);
  if(levelNumber===1&&weight.seated&&tutorial.stage==='passage')instruction='Найдите узкий проход к нижней кнопке';
  if(objective.textContent!==instruction)objective.textContent=instruction;
  const control=tutorial.stage==='shed'?(matchMedia('(pointer: coarse)').matches?'Удерживайте касание':'Удерживайте ЛКМ или пробел'):tutorial.stage==='move'?'Можно двигаться стрелками':levelNumber>1?(helpShown?'H — скрыть подсказку':'H — подсказка'):'';
  if(hint.textContent!==control)hint.textContent=control;
  if(opening>=1 && Math.hypot(drop.x-well.x,drop.y-well.y)<59){
    flowLift=reduced.matches?0:drop.effort*3.8*(.5+.5*Math.sin(drop.stride-.7));
    flowTime=0;exitRest=0;keys.clear();shedding=false;stopPointer();hint.textContent='';objective.textContent='';
    sound.play('flowIn');
  }
  elapsed+=stepTime;
}
function devices(){
  if(levelNumber>=3){drawCampaignDevices();mechanisms?.drawDevices?.();return;}
  const {x,y}=plate;
  const {x:sx,y:sy}=socket;
  oval(ctx,sx+2,sy+3,45,45,'#aaa590');oval(ctx,sx,sy,45,45,'#747867');oval(ctx,sx,sy,41,41,'#d7cfb7');
  oval(ctx,sx,sy,36,36,'#a8573e');oval(ctx,sx,sy,32,32,'#c1b39c');
  // Matching rings on the roller and socket identify the mating parts.
  ctx.beginPath();ctx.arc(sx,sy,13,0,TAU);ctx.strokeStyle='#914930';ctx.lineWidth=3;ctx.stroke();
  if(levelNumber===2?spool.seated:weight.seated){
    // Paint the exposed lead; the raised rail continues to sit above it.
    ctx.save();socketWire(ctx);ctx.lineWidth=1.4;ctx.strokeStyle=rust;ctx.stroke();ctx.restore();
  }
  if(weight.seated){ctx.beginPath();ctx.arc(sx,sy,42,0,TAU);ctx.strokeStyle=rust;ctx.lineWidth=4;ctx.stroke();}
  if(opening>0){
    const progress=exitWireProgress();
    ctx.save();traceWire(ctx);ctx.strokeStyle=rust;ctx.lineWidth=1.8;ctx.lineCap='round';
    ctx.setLineDash(progress>=1?[]:[exitWireLength*progress,exitWireLength+4]);ctx.stroke();ctx.restore();
  }
  oval(ctx,x+3,y+5,24,22,'#999584');oval(ctx,x,y,24,22,'#63675a');
  const press=buttonPress*buttonPress*(3-2*buttonPress),faceY=y-4+4*press;
  oval(ctx,x,faceY,21,19,press>.5?'#94412d':'#c85d40');
  ctx.strokeStyle='#f1c6a4';ctx.lineWidth=1.25;ctx.beginPath();ctx.arc(x,faceY,13,0,TAU);ctx.stroke();
  const pulseAge=levelNumber===2?gateAge:unlocked?portalAge:-1;
  if(pulseAge>=0&&pulseAge<1.25){
    ctx.save();ctx.globalAlpha=(1-pulseAge/1.25)*.48;ctx.strokeStyle='#9d523c';ctx.lineWidth=1;
    for(let i=0;i<2;i++){const r=24+pulseAge*(30+i*18);ctx.beginPath();ctx.ellipse(x,y,r,r*.9,0,0,TAU);ctx.stroke();}ctx.restore();
  }
  drawPortal();
  if(topoLayout.seal){
    const p=topoLayout.seal,press=sealPress*sealPress*(3-2*sealPress);
    oval(ctx,p.x+3,p.y+5,24,22,'#999584');oval(ctx,p.x,p.y,24,22,'#63675a');
    oval(ctx,p.x,p.y-4+4*press,21,19,unlocked?'#94412d':'#c85d40');
    ctx.beginPath();ctx.arc(p.x,p.y-4+4*press,13,0,TAU);ctx.lineWidth=1.25;ctx.strokeStyle='#f1c6a4';ctx.stroke();
  }
}
function drawPortal(){
  const wx=well.x,wy=well.y,t=opening,u=t*t*(3-2*t),flow=flowTime===null?0:flowTime;
  ctx.save();
  oval(ctx,wx+2,wy+3,44,39,'rgba(46,59,45,.12)');
  oval(ctx,wx,wy,41,36,'#a7b39d');oval(ctx,wx,wy,37,32,'#d0d5c3');
  for(let k=0;k<5;k++){
    ctx.beginPath();
    const r=39+k*4+Math.sin(portalAge*2-k*.7)*u*.8;
    for(let j=0;j<=80;j++){
      const a=j/80*TAU,rr=r+Math.sin(a*3+k*.7)*1.1;
      const x=wx+Math.cos(a)*rr,y=wy+Math.sin(a)*rr*.87;
      if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
    }
    ctx.strokeStyle=k?'rgba(107,127,103,.36)':'#71826b';ctx.lineWidth=k?.65:1.1;ctx.stroke();
  }
  const hole=2+29*u;
  oval(ctx,wx,wy,hole,hole*.87,'#141e19');
  if(u>.05){
    const wet=ctx.createRadialGradient(wx-7,wy-9,1,wx,wy,hole);
    wet.addColorStop(0,'#21352b');wet.addColorStop(.55,'#101b16');wet.addColorStop(1,'#050c08');
    oval(ctx,wx,wy,hole,hole*.87,wet);
  }
  for(let k=0;k<7;k++){
    const a=k*TAU/7+u*.46,outer=35,inner=Math.max(3,hole);
    ctx.beginPath();ctx.moveTo(wx+Math.cos(a)*outer,wy+Math.sin(a)*outer*.87);
    ctx.bezierCurveTo(wx+Math.cos(a+.45)*29,wy+Math.sin(a+.45)*29*.87,
      wx+Math.cos(a+.8)*inner,wy+Math.sin(a+.8)*inner*.87,
      wx+Math.cos(a+.56)*inner,wy+Math.sin(a+.56)*inner*.87);
    ctx.strokeStyle='#7a8972';ctx.lineWidth=.85;ctx.stroke();
  }
  if(unlocked){
    ctx.save();ctx.beginPath();ctx.ellipse(wx,wy,hole,hole*.87,0,0,TAU);ctx.clip();
    for(let k=0;k<3;k++){
      ctx.beginPath();
      for(let j=0;j<70;j++){
        const q=j/69,a=q*TAU*1.15+portalAge*.5+k*TAU/3,r=(3+q*24)*(1-flow*.65);
        const x=wx+Math.cos(a)*r,y=wy+Math.sin(a)*r*.87;
        if(j===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      }
      ctx.strokeStyle='rgba(116,146,123,.14)';ctx.lineWidth=.75;ctx.stroke();
    }ctx.restore();
  }
  ctx.restore();
}
function portalForeground(){
  if(flowTime===null)return;
  const t=flowTime;
  if(t>.16){
    const r=17+8*Math.min(1,(t-.16)/.55);
    oval(ctx,well.x,well.y,r,r*.87,'#0a130e');
  }
  ctx.beginPath();ctx.ellipse(well.x,well.y,34,29.5,0,0,Math.PI);
  ctx.strokeStyle='#a9bba7';ctx.lineWidth=2.4;ctx.stroke();
  ctx.beginPath();ctx.ellipse(well.x,well.y+1,31,27,0,0,Math.PI);
  ctx.strokeStyle='#3d5141';ctx.lineWidth=1;ctx.stroke();
}
function drawWeight(object=weight){
  const {x,y,radius:r,position}=object;
  if(object===spool){
    oval(ctx,x+2,y+3,r+1,r,'#a6ad9e');oval(ctx,x,y-3,r,r,'#6c7d73');oval(ctx,x,y-6,r,r,'#b7c5b5');
    ctx.save();ctx.translate(x,y-6);ctx.rotate(position/45);ctx.strokeStyle='#637e70';ctx.lineWidth=1.2;
    for(const rr of [10,18]){ctx.beginPath();ctx.arc(0,0,rr,0,TAU);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-14,0);ctx.lineTo(14,0);ctx.stroke();oval(ctx,0,0,4,4,'#6b8071');ctx.restore();return;
  }
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
  const local=clamp(t+.21*front*Math.sin(Math.PI*t),0,1),ease=1-Math.pow(1-local,2.2);
  const angle=.45*Math.sin(Math.PI*local)*local,co=Math.cos(angle),si=Math.sin(angle);
  const x=p.x-well.x,y=p.y-well.y,momentum=.09*t*(1-t)*(1-t);
  return {x:well.x+(x*co-y*si)*(1-ease)+drop.vx*momentum,
    y:well.y+(x*si+y*co)*(1-ease)+drop.vy*momentum};
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
    const delay=i/(points.length-1)*.28;
    return {...flowPoint(p,t,delay),width:p.width*(1-t*t)};
  }):drop.tail.points;
  if(!flowing){
    ctx.save();ctx.translate(1.5,2);ctx.fillStyle='rgba(43,39,26,.12)';
    ctx.fill(tailOutline(tail,0));ctx.restore();
  }
  ctx.save();ctx.translate(3,4);ctx.globalAlpha=1-t;
  ctx.fillStyle='rgba(43,39,26,.12)';ctx.fill(outline);ctx.restore();
  ctx.fillStyle='#121511';ctx.fill(tailOutline(tail,(6+(flowing?flowLift:lift))*(1-t)));
  ctx.translate(0,-(6+(flowing?flowLift:lift))*(1-t));ctx.fillStyle='#121511';ctx.fill(outline);
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
    ctx.globalAlpha=flowing?1-clamp((t-.24)/.42,0,1):1;
    oval(ctx,pos.x,pos.y,size,size/tilt*blink,'#fffdf5');
  }ctx.restore();
}
function drawPrinterShadow(){
  if(levelNumber!==2||headAge<0||headAge>6.3)return;
  const progress=headAge/6.3,opacity=Math.sin(Math.PI*progress);
  const y=reduced.matches?1300:750+headAge*235;
  ctx.save();ctx.globalAlpha=opacity;ctx.transform(1,-.14,0,1,0,y);
  const shade=ctx.createLinearGradient(0,-150,0,190);
  shade.addColorStop(0,'rgba(23,30,29,0)');shade.addColorStop(.22,'rgba(23,30,29,.035)');
  shade.addColorStop(.4,'rgba(23,30,29,.14)');shade.addColorStop(.7,'rgba(23,30,29,.16)');
  shade.addColorStop(.9,'rgba(23,30,29,.055)');shade.addColorStop(1,'rgba(23,30,29,0)');
  ctx.fillStyle=shade;ctx.fillRect(-1600,-150,4600,340);
  ctx.fillStyle='rgba(24,32,28,.045)';ctx.fillRect(-1600,-5,4600,11);ctx.fillRect(-1600,106,4600,5);
  for(let x=-1500;x<2900;x+=36)ctx.fillRect(x,116,10,28);
  ctx.restore();
}
function draw(){
  ctx=worldCtx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);
  const s=baseScale*camera.zoom;
  ctx.translate(width/2,height/2);ctx.scale(s,s*tilt);ctx.translate(-camera.x,-camera.y+sheetOffset());
  terrain.draw(ctx);
  if(activationBlend>0){
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.fillStyle='rgba(119,171,194,'+(activationBlend*.26)+')';
    ctx.fillRect(camera.x-width/s,camera.y-height/(s*tilt),2*width/s,2*height/(s*tilt));ctx.restore();
  }
  drawFloorPrint();drawInk();devices();drawMarks();
  const actors=hasWeight()?[drop,weight]:[drop];
  if(spool)actors.push(spool);
  const companion=mechanisms?.companion;
  if(companion)actors.push(companion);
  actors.sort((a,b)=>a.y-b.y).forEach(actor=>{
    if(actor===drop)drawDrop();
    else if(actor===companion)companion.draw();
    else drawWeight(actor);
  });
  portalForeground();
  drawPrinterShadow();
  drawRollers();
  mechanisms?.drawOverlay?.();
  ctx=screenCtx;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle=paper;ctx.fillRect(0,0,width,height);
  const shake=!reduced.matches&&activationAge>=0&&activationAge<2.4?7*Math.exp(-activationAge*4.2):0;
  const printerShake=reduced.matches?0:(mechanisms?.shake||0)+(headAge>=0&&headAge<6.3?.8*Math.sin(Math.PI*headAge/6.3):0);
  const dx=Math.sin(activationAge*59)*shake+Math.sin(elapsed*83)*printerShake,dy=Math.sin(activationAge*47+.8)*shake*.67+Math.sin(elapsed*67)*printerShake*.6;
  ctx.save();ctx.translate(dx,dy);ctx.drawImage(worldFrame,0,0,canvas.width,canvas.height,0,0,width,height);
  if(!reduced.matches&&activationAge>.025&&activationAge<2.35){
    const ox=width/2+(socket.x-camera.x)*s,oy=height/2+(socket.y-camera.y)*s*tilt;
    const radius=activationAge*720*s,amplitude=6.8*(1-activationAge/2.35);
    for(let band=-5;band<=5;band++){
      const mid=radius+band*6,inner=Math.max(.1,mid-4),outer=mid+4;if(outer<1)continue;
      const displacement=Math.sin(band*.65)*Math.exp(-band*band/13)*amplitude;
      ctx.save();ctx.beginPath();ctx.ellipse(ox,oy,outer,outer*tilt,0,0,TAU);ctx.ellipse(ox,oy,inner,inner*tilt,0,0,TAU);ctx.clip('evenodd');
      const stretch=1+displacement/Math.max(10,mid);ctx.translate(ox,oy);ctx.scale(stretch,stretch);ctx.translate(-ox,-oy);
      ctx.drawImage(worldFrame,0,0,canvas.width,canvas.height,0,0,width,height);ctx.restore();
    }
    ctx.beginPath();ctx.ellipse(ox,oy,Math.max(.1,radius),Math.max(.1,radius*tilt),0,0,TAU);
    ctx.strokeStyle='rgba(248,255,244,'+(.12*(1-activationAge/2.35))+')';ctx.lineWidth=1.3;ctx.stroke();
  }
  ctx.restore();
}
function frame(time){
  const seconds=prev?(time-prev)/1000:0;
  const flowing=flowTime!==null&&!solved;
  lag+=Math.min(seconds,.05);
  prev=time;
  while(lag>=stepTime){update();lag-=stepTime;}
  if(flowing)advanceFlow(seconds);
  sound.rolling(flowTime===null?(Math.abs(weight.speed)+Math.abs(spool?.speed||0)*.35)/150:0);
  draw();requestAnimationFrame(frame);
}
function hasWeight(){return levelNumber<=2||levelNumber===6||levelNumber===7;}
drawTerrain();reset();size();window.addEventListener('resize',size);requestAnimationFrame(frame);
