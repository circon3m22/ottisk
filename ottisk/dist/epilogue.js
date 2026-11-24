'use strict';

const epilogueDuration=17.4;
const endingEase=(a,b,t)=>{
  const x=clamp((t-a)/(b-a),0,1);
  return x*x*(3-2*x);
};

function drawEpilogue(t){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#131817';ctx.fillRect(0,0,width,height);
  const scale=Math.min(width/1280,height/720);
  ctx.translate((width-1280*scale)/2,(height-720*scale)/2);
  ctx.scale(scale,scale);
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,1280,720);ctx.clip();
  const pull=endingEase(.3,4.4,t),placed=endingEase(6.8,8.2,t),close=endingEase(10.9,13.2,t);
  const paperY=-170+350*pull+62*placed;
  const pageX=355,paperWidth=570,paperHeight=415;
  const mouseY=paperY+228;
  const mouseX=585+57*endingEase(12.1,14.6,t);
  ctx.save();
  ctx.translate(640,380);
  ctx.scale(1+2.42*close,1+2.42*close);
  ctx.translate(-640,-380+(mouseY-390)*-close);
  drawEndingDesk(pull,t);
  ctx.save();
  ctx.beginPath();ctx.rect(0,193,1280,800);ctx.clip();
  drawEndingPage(pageX,paperY,paperWidth,paperHeight,t);
  const roof=endingEase(8.3,10.7,t);
  if(roof>0)drawEndingRoof(642,mouseY,roof);
  drawEndingInk(mouseX,mouseY,12.5,2,t>5.4);
  const company=[[-43,35],[-69,-22],[-103,18],[-133,-9]];
  company.forEach(([x,y],i)=>{
    const motion=endingEase(12.3+i*.24,15+i*.25,t);
    drawEndingInk(585+x+(76+i*12)*motion,mouseY+y*(1-motion*.37),4.7+i*.85,1,t>6+i*.24);
  });
  ctx.restore();
  const approach=endingEase(4.35,5.8,t),lift=endingEase(6.2,7.8,t);
  if(approach>0&&lift<1)drawEndingHand(607+465*(1-approach)+390*lift,mouseY-28-110*lift);
  if(roof>0&&roof<1){
    const p=roofPoint(642,mouseY,roof);
    drawEndingPencil(p.x,p.y);
  }
  ctx.restore();

  const dark=endingEase(14.9,epilogueDuration-.7,t);
  if(dark>0){
    ctx.fillStyle='rgba(13,18,17,'+(.97*dark)+')';
    ctx.fillRect(0,0,1280,720);
    if(dark>.18){
      const eyes=[{x:mouseX-3.8,y:mouseY-3.3,r:1.64},{x:mouseX+3.8,y:mouseY-3.3,r:1.64}];
      company.forEach(([x,y],i)=>{
        const motion=endingEase(12.3+i*.24,15+i*.25,t);
        eyes.push({x:585+x+(76+i*12)*motion,y:mouseY+y*(1-motion*.37)-1.7,r:.97});
      });
      const zoom=1+2.42*close;
      ctx.globalAlpha=(dark-.18)/.82;
      for(const eye of eyes){
        const x=640+(eye.x-640)*zoom,y=380+(eye.y-380-(mouseY-390)*close)*zoom;
        oval(ctx,x,y,eye.r*zoom,eye.r*zoom,'#f5f4e8');
      }
      ctx.globalAlpha=1;
    }
  }
  ctx.restore();
}

function drawEndingDesk(pull,t){
  const desk=ctx.createLinearGradient(0,180,0,720);
  desk.addColorStop(0,'#635c4a');desk.addColorStop(.65,'#8e7759');desk.addColorStop(1,'#66533d');
  ctx.fillStyle=desk;ctx.fillRect(0,0,1280,720);
  ctx.strokeStyle='rgba(56,45,33,.14)';ctx.lineWidth=1.2;
  for(let i=0;i<34;i++){
    const y=i*24+9*Math.sin(i*2.3);
    ctx.beginPath();ctx.moveTo(0,y);
    ctx.bezierCurveTo(380,y+16*Math.sin(i),840,y-8*Math.cos(i),1280,y+11*Math.sin(i*.7));ctx.stroke();
  }
  const lamp=ctx.createRadialGradient(645,390,13,640,370,564);
  lamp.addColorStop(0,'rgba(255,216,140,.27)');
  lamp.addColorStop(1,'rgba(255,216,140,0)');
  ctx.fillStyle=lamp;ctx.fillRect(0,0,1280,720);
  const housing=ctx.createLinearGradient(0,0,0,231);
  housing.addColorStop(0,'#5b625a');housing.addColorStop(.76,'#363e37');housing.addColorStop(1,'#26312c');
  ctx.fillStyle='rgba(21,27,21,.41)';ctx.beginPath();ctx.roundRect(231,-32,824,285,20);ctx.fill();
  ctx.fillStyle=housing;ctx.beginPath();ctx.roundRect(220,-46,840,280,22);ctx.fill();
  ctx.strokeStyle='#838779';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(242,133);ctx.lineTo(1038,133);ctx.stroke();
  ctx.fillStyle='#202823';ctx.beginPath();ctx.roundRect(334,174,611,37,10);ctx.fill();
  ctx.fillStyle='#868579';ctx.fillRect(351,184,577,2);
  for(let i=0;i<13;i++){
    ctx.fillStyle='rgba(29,42,34,.49)';
    ctx.fillRect(268+i*6,33,2,75-5*Math.sin(i*.24));
  }
  oval(ctx,1002,74,5,5,pull<.99&&Math.sin(t*9)>.2?'#e8b377':'#92a387');
}

function drawEndingPage(x,y,w,h,t){
  ctx.save();
  ctx.shadowColor='rgba(28,24,20,.41)';ctx.shadowBlur=16;ctx.shadowOffsetY=9;
  const paper=ctx.createLinearGradient(x,y,x+490,y+360);
  paper.addColorStop(0,'#e9e2c8');paper.addColorStop(.44,'#fcf4d8');paper.addColorStop(1,'#f0e5c9');
  ctx.fillStyle=paper;
  ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y+3);
  ctx.quadraticCurveTo(x+w-5,y+h*.68,x+w+2,y+h-5);
  ctx.quadraticCurveTo(x+w*.45,y+h+9,x-1,y+h);
  ctx.quadraticCurveTo(x+3,y+h*.45,x,y);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.clip();
  const glyphs=['#','Ы','a','}','8','э','¤','?', 'г','ш','0','~'];
  for(let row=0;row<8;row++){
    for(let i=0;i<16;i++){
      const px=x+37+i*33,py=y+55+40*row+6*Math.sin(i+row);
      if(Math.hypot(px-595,(py-(y+228))*1.3)<150)continue;
      const hash=Math.sin((i+1)*27.21+(row+6)*31.6);
      ctx.save();ctx.translate(px,py);ctx.rotate(hash*.23);
      ctx.fillStyle='rgba(48,46,36,'+(.12+.19*Math.abs(hash))+')';
      ctx.font=(16+(i*7+row)%7)+'px Georgia,serif';
      ctx.fillText(glyphs[(i*3+row*5)%glyphs.length],0,0);
      ctx.restore();
    }
  }
  ctx.strokeStyle='rgba(91,83,57,.17)';ctx.lineWidth=1;
  for(let i=0;i<13;i++){
    const py=y+47+i*26;
    ctx.beginPath();ctx.moveTo(x+32,py);
    ctx.quadraticCurveTo(x+w*.33,py+Math.sin(i)*18,x+w-28,py-2*Math.sin(i*7));ctx.stroke();
  }
  for(const [px,py,rx,ry] of [[x+360,y+79,50,12],[x+111,y+330,41,13],[x+460,y+324,38,11],[x+406,y+166,23,8]]){
    oval(ctx,px,py,rx,ry,'rgba(54,52,38,.16)');
    oval(ctx,px+4,py+1,rx*.74,ry*.53,'rgba(54,52,38,.13)');
  }
  ctx.restore();
}

function drawEndingHand(x,y){
  ctx.save();ctx.translate(x,y);ctx.rotate(-.11);
  const skin=ctx.createLinearGradient(28,-40,85,78);
  skin.addColorStop(0,'#dfb491');skin.addColorStop(.5,'#bd8b6c');skin.addColorStop(1,'#895640');
  ctx.shadowColor='rgba(38,28,22,.36)';ctx.shadowBlur=17;ctx.shadowOffsetY=9;
  ctx.fillStyle=skin;
  ctx.beginPath();ctx.moveTo(880,-133);
  ctx.bezierCurveTo(530,-89,322,-55,262,-36);
  ctx.bezierCurveTo(227,-23,181,-31,138,-20);
  ctx.bezierCurveTo(100,-9,65,-12,37,-12);
  ctx.bezierCurveTo(7,-13,-8,-6,-6,3);
  ctx.bezierCurveTo(-3,14,24,15,44,12);
  ctx.bezierCurveTo(87,8,128,15,159,16);
  ctx.bezierCurveTo(131,31,103,39,105,53);
  ctx.bezierCurveTo(112,75,153,57,176,49);
  ctx.bezierCurveTo(167,73,191,77,208,63);
  ctx.bezierCurveTo(217,84,254,69,263,49);
  ctx.bezierCurveTo(318,59,455,32,880,35);
  ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  ctx.strokeStyle='rgba(99,58,44,.37)';ctx.lineWidth=1.8;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(68,-5);ctx.quadraticCurveTo(74,0,70,6);
  ctx.moveTo(145,1);ctx.quadraticCurveTo(157,6,159,16);
  ctx.moveTo(177,48);ctx.quadraticCurveTo(209,26,233,24);ctx.stroke();
  oval(ctx,13,0,14,6,'rgba(245,205,179,.52)');
  ctx.restore();
}

function roofPoint(x,y,t){
  const path=[[-27,-7],[0,-29],[27,-7],[20,-7],[20,16],[-20,16],[-20,-7]];
  const traces=[0,1,2,3,4,5,6],at=t*(traces.length-1);
  const i=Math.min(Math.floor(at),traces.length-2),f=at-i;
  const [ax,ay]=path[i],[bx,by]=path[i+1];
  return {x:x+ax+(bx-ax)*f,y:y+ay+(by-ay)*f};
}
function drawEndingRoof(x,y,t){
  ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#514c3c';ctx.lineWidth=1.75;
  ctx.beginPath();
  for(let i=0;i<=36;i++){
    const p=roofPoint(x,y,t*i/36);
    if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
  }
  ctx.stroke();
}
function drawEndingPencil(x,y){
  ctx.save();ctx.translate(x,y);ctx.rotate(-Math.PI*.39);
  ctx.shadowColor='rgba(49,38,22,.31)';ctx.shadowBlur=5;ctx.shadowOffsetY=4;
  const hand=ctx.createLinearGradient(0,-23,0,36);
  hand.addColorStop(0,'#d4a784');hand.addColorStop(1,'#95644f');
  ctx.fillStyle=hand;
  ctx.beginPath();ctx.moveTo(710,-62);
  ctx.bezierCurveTo(310,-64,159,-53,124,-36);
  ctx.bezierCurveTo(106,-33,88,-41,75,-22);
  ctx.bezierCurveTo(54,-20,55,2,71,10);
  ctx.bezierCurveTo(98,15,104,33,132,32);
  ctx.bezierCurveTo(218,21,410,25,710,47);
  ctx.closePath();ctx.fill();
  ctx.fillStyle='#ad844c';ctx.fillRect(18,-4,118,8);
  ctx.fillStyle='#eae0bd';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(18,-4);ctx.lineTo(18,4);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
  oval(ctx,76,-5,17,7,'#c89674');
  ctx.strokeStyle='#443f36';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(5,0);ctx.stroke();
  ctx.restore();
}
function drawEndingInk(x,y,r,eyes,awake){
  oval(ctx,x+.5,y+1.5,r+1,r*.89,'rgba(48,49,37,.21)');
  oval(ctx,x,y,r,r*.84,'#22261f');
  if(awake){
    const spacing=eyes===2?3.8:0;
    for(let i=0;i<eyes;i++){
      const rx=eyes===2?x+(i===0?-spacing:spacing):x;
      const size=eyes===2?1.64:.97;
      oval(ctx,rx,y-(eyes===2?3.3:1.7),size,size,'#fffce7');
    }
  }
}
