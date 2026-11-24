'use strict';

const nearPoint=(actor,point,distance)=>Math.hypot(actor.x-point.x,actor.y-point.y)<distance;
const fromPair=([x,y])=>({x,y});

function chapterTrace(curves,color,width=1.45){
  traceCurves(ctx,curves);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function ring(x,y,r,color,width=1.45,start=0,end=TAU){
  ctx.beginPath();ctx.ellipse(x,y,r,r*.86,0,start,end);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
function chapterContact(point,active,amount=Number(active),radius=29){
  const {x,y}=point;
  oval(ctx,x+2,y+3,radius+2,radius*.88,'#8a907b');
  oval(ctx,x,y,radius,radius*.87,active?'#aaa58a':'#d5d0bd');
  ring(x,y,radius-4,active?rust:'#706f61');
  ring(x,y,radius-9,'#f0e4cd',1);
  if(amount>0)ring(x,y,radius+4,rust,2,-Math.PI/2,-Math.PI/2+TAU*clamp(amount,0,1));
}
function chapterRail(rail){
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  for(const [width,color] of [[13,'#b9aa94'],[6,'#756955'],[2,'#d9c7ad']]){
    railPath(ctx,rail);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();
  }
  ctx.strokeStyle='#9a876d';ctx.lineWidth=1;
  for(let s=20;s<rail.length-15;s+=20){
    const p=rail.point(s),dx=p.ty*6,dy=-p.tx*6;
    ctx.beginPath();ctx.moveTo(p.x-dx,p.y-dy);ctx.lineTo(p.x+dx,p.y+dy);ctx.stroke();
  }
  ctx.restore();
}
function chapterPath(path,density=4){
  return path.filter((_,i)=>i%density===density-1).map(s=>({x:s.x+s.dx,y:s.y+s.dy,onPaper:true}));
}

class BracketMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.surveyed=false;
    this.sealed=false;
    this.printAge=-1;
    this.lastEnd=false;
  }
  advance(){
    if(weight.seated&&!this.lastEnd){sound.play('seat');ripple(socket.x,socket.y,34,rust);}
    this.lastEnd=weight.seated;
    if(!this.surveyed&&gateOpening>.85&&nearPoint(drop,plate,39)){
      this.surveyed=true;
      sound.play('plate');
      ripple(plate.x,plate.y,36,rust);
    }
    gateOpening=this.channel(gateOpening,weight.seated&&!this.sealed,heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,this.surveyed&&weight.atStart&&!this.sealed,heightMap.lowerGatePath);
    if(!this.sealed&&drop.y>1925&&lowerOpening>.6){
      this.sealed=true;
      this.printAge=0;
      sound.play('printer');
    }
    if(this.printAge>=0)this.printAge+=stepTime;
    this.setExit(this.sealed);
  }
  get goal(){
    if(this.sealed)return 'Ровный отпечаток закрыл скобки.';
    if(!this.surveyed)return weight.seated?'Внутренняя скобка раскрыта.':'Две скобки соединены одним приводом.';
    return weight.atStart?'Наружная скобка раскрыта.':'Внутренний контакт нажат.';
  }
  get message(){
    if(this.sealed)return 'Выход в следующем отпечатке.';
    if(!this.surveyed)return weight.seated?'Пройдите внутрь и нажмите контакт.':'Толкните медный груз к правому гнезду.';
    if(!weight.atStart)return 'Вернитесь, обойдите груз справа и толкните его в левое гнездо.';
    return 'Сбросьте часть чернил перед тонкой правой скобкой.';
  }
  drawFloor(){
    chapterTrace(topoLayout.mechanismWire,this.surveyed?rust:'#a49785');
    chapterTrace([topoLayout.lowerGate.points],this.surveyed&&weight.atStart?rust:'#a49785');
    chapterRail(weight.rail);
    chapterContact(railStart,weight.atStart,Number(this.surveyed&&weight.atStart),38);
    chapterContact(socket,weight.seated,Number(weight.seated),38);
    chapterContact(plate,this.surveyed);
  }
  drawDevices(){
    for(const [index,point,amount] of [[0,{x:539,y:1038},gateOpening],[1,{x:1133,y:1355},lowerOpening]]){
      ctx.save();ctx.translate(point.x,point.y);ctx.rotate(index?-.36:.24);
      for(const side of [-1,1]){
        const arm=(index?36:53)+amount*33,hinge=side*(index?72:100);
        oval(ctx,hinge,0,6,5,'#83674e');
        ctx.save();ctx.translate(hinge,0);ctx.rotate(side*amount*.5);
        ctx.beginPath();ctx.moveTo(-side*arm,-39);ctx.quadraticCurveTo(side*25,0,-side*arm,39);
        ctx.lineWidth=4;ctx.strokeStyle='#95694c';ctx.stroke();
        ctx.lineWidth=1.1;ctx.strokeStyle='#e2c8a8';ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
  }
  drawOverlay(){
    if(this.printAge<0||this.printAge>2.1)return;
    const alpha=Math.sin(Math.PI*this.printAge/2.1)*.32;
    const y=reduced.matches?1850:1650+this.printAge*175;
    const band=ctx.createLinearGradient(0,y-85,0,y+70);
    band.addColorStop(0,'rgba(64,49,32,0)');
    band.addColorStop(.56,'rgba(64,49,32,'+alpha+')');
    band.addColorStop(1,'rgba(64,49,32,0)');
    ctx.fillStyle=band;ctx.fillRect(-850,y-85,3200,155);
  }
}

class WetPaperMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.bridgeLatched=false;
    this.fracture=0;
    this.lastStable={...spawn};
    this.crossing=null;
  }
  onSeam(actor){
    const p=topoLayout.fragile;
    return actor.x>p.left&&actor.x<p.right&&actor.y>p.top&&actor.y<p.bottom;
  }
  capture(){
    return {
      ink:drop.ink+shedAmount,
      pools:inkPools.map(pool=>Object.assign(Object.create(InkDrop.prototype),pool,{
        lobes:pool.lobes.map(lobe=>({...lobe})),
        nodes:pool.nodes.map(node=>({...node}))
      })),
      weight:{position:weight.position,locked:weight.locked},
      checkpoint:{...this.lastStable}
    };
  }
  advance(){
    const seam=topoLayout.fragile;
    if(this.onSeam(drop)){
      if(!this.crossing)this.crossing=this.capture();
      const heavy=drop.ink>seam.mass;
      if(heavy&&this.fracture===0){sound.play('paperCrack');ripple(drop.x,drop.y,24,'#6e8e82');}
      this.fracture=clamp(this.fracture+(heavy?stepTime:-stepTime*2),0,seam.duration);
      if(this.fracture>=seam.duration){
        this.rewind={age:0,x:drop.x,y:drop.y,radius:drop.bodyRadius};
        sound.play('paperTear');
        return;
      }
    }else{
      this.lastStable={x:drop.x,y:drop.y};
      this.crossing=null;
      this.fracture=0;
    }
    if(!this.bridgeLatched&&nearPoint(drop,plate,39)){
      this.bridgeLatched=true;
      sound.play('open');ripple(plate.x,plate.y,40,rust);
    }
    gateOpening=this.channel(gateOpening,this.bridgeLatched,heightMap.gatePath);
    this.setExit(weight.seated);
  }
  recover(){
    this.rewind.age+=stepTime;
    if(this.rewind.age<.64)return;
    const saved=this.crossing;
    drop=new Drop(saved.checkpoint.x,saved.checkpoint.y,saved.ink);
    inkPools=saved.pools;
    Object.assign(weight,saved.weight,{speed:0});
    const position=weight.rail.point(weight.position);
    weight.x=position.x;weight.y=position.y;
    shedding=false;shedAmount=0;shedTime=0;keys.clear();stopPointer();
    this.fracture=0;this.rewind=null;this.crossing=null;
    ripple(drop.x,drop.y,38,'#648a7a');
  }
  get shake(){return this.fracture>0?this.fracture*3:0;}
  get goal(){
    if(this.rewind)return 'Бумага порвалась под весом.';
    if(this.fracture>0)return 'Шов трескается.';
    if(weight.seated)return 'Противовес освободил выход.';
    return this.bridgeLatched?'Прочный обход открыт.':'Прямой шов намок.';
  }
  get message(){
    if(this.rewind)return 'Запас вернётся к началу шва.';
    if(this.fracture>0)return 'Отойдите на целую бумагу и сбросьте чернила.';
    if(weight.seated)return 'Выход за противовесом.';
    if(this.bridgeLatched)return 'Вернитесь за чернилами и перенесите их по обходу к грузу.';
    return 'Оставьте часть чернил перед швом. Перейдите налегке и откройте обход.';
  }
  drawFloor(){
    chapterTrace(topoLayout.mechanismWire,this.bridgeLatched?rust:'#8c9d88');
    chapterTrace(topoLayout.exitWire,weight.seated?rust:'#8c9d88');
    chapterRail(weight.rail);chapterContact(socket,weight.seated,Number(weight.seated),42);
    chapterContact(plate,this.bridgeLatched);
    const crack=topoLayout.fragile;
    for(let i=0;i<7;i++){
      const y=crack.top+26+i*61,x=545+13*Math.sin(i*1.36);
      const size=13+(this.fracture/crack.duration)*15+(this.rewind?22:0);
      ctx.beginPath();ctx.moveTo(x-27,y-10);
      ctx.lineTo(x-11,y+1);ctx.lineTo(x+4,y-7);ctx.lineTo(x+size,y+5);
      ctx.strokeStyle='#5e8177';ctx.lineWidth=1.1;ctx.stroke();
      ctx.lineTo(x+1,y+size*.4);ctx.lineTo(x-13,y+6);ctx.closePath();
      ctx.fillStyle='rgba(55,89,77,.2)';ctx.fill();
      ctx.save();ctx.clip();
      oval(ctx,x+2,y+6,11,10,'#243e34');
      ctx.restore();
    }
  }
  drawOverlay(){
    if(!this.rewind)return;
    const {x,y,age,radius}=this.rewind;
    const r=radius+34*Math.sin(Math.PI*clamp(age/.64,0,1));
    oval(ctx,x,y,r,r*.68,'#4e7064');
    oval(ctx,x,y+3,r*.77,r*.48,'#283d35');
    ring(x,y,r+6,'#a8c0ad',1.3);
  }
}

class OverprintMechanism extends PrintMechanisms {
  constructor(){
    super();this.printAge=-1;this.phase=-1;this.lastStrike=-1;
  }
  advance(){
    if(started)this.time+=stepTime;
    const t=this.time%9;
    this.phase=t<4.35?0:t<4.95?-1:t<8.45?1:-1;
    const cycle=Math.floor(this.time/4.5);
    if(started&&cycle!==this.lastStrike){
      this.lastStrike=cycle;
      if(Math.abs(drop.y-1170)<1000)sound.play('overprint');
    }
    gateOpening=this.channel(gateOpening,this.phase===0,heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,this.phase===1,heightMap.lowerGatePath);
    if(this.printAge<0&&drop.y>1915&&nearPoint(drop,topoLayout.printMark,100)){
      this.printAge=0;sound.play('overprint');
    }
    if(this.printAge>=0){
      const before=this.printAge;
      this.printAge+=stepTime;
      if(before<1.4&&this.printAge>=1.4){
        const {x,y}=topoLayout.printMark;
        for(let i=0;i<5;i++){
          const a=TAU*i/5;
          const pool=new InkDrop(x+Math.cos(a)*21,y+Math.sin(a)*21,a,.032);
          pool.vx=Math.cos(a)*48;pool.vy=Math.sin(a)*48;
          inkPools.push(pool);
        }
        ripple(x,y,45,'#6f8297');sound.play('inkOut');
      }
    }
    this.setExit(this.printAge>1.4);
  }
  get shake(){
    return !started?0:Math.max(0,1-this.time%4.5/.35)*1.7;
  }
  get goal(){
    if(unlocked)return 'Последний знак распался.';
    if(this.printAge>=0)return 'Строка собирается.';
    if(drop.y<850)return this.phase===0?'Головка печатает верхнюю перемычку.':'Верхняя перемычка ждёт нового прохода головки.';
    return this.phase===1?'Нижняя часть петли допечатана.':'Нижний штрих ещё не напечатан.';
  }
  get message(){
    if(unlocked)return 'Следуйте к отверстию.';
    if(drop.y>1760)return 'Остановитесь у последнего знака.';
    return 'Штрихи печатаются попеременно. Дождитесь своего прохода на широкой площадке.';
  }
  drawFloor(){
    const time=this.time%9;
    const curves=topoLayout.mechanismWire;
    chapterTrace([curves[0]],gateOpening>.64?'#697e9e':'#a0aaba',2);
    chapterTrace([curves[1]],'#929caa',1.3);
    chapterTrace([curves[2]],lowerOpening>.64?'#697e9e':'#a0aaba',2);
    chapterTrace([curves[3]],'#929caa',1.3);
    const glyphs=['р','§','₽','е','9','п','∂','а','ъ','∞','я','о','ц','?','т'];
    ctx.save();
    ctx.font='italic 87px Georgia, serif';ctx.textAlign='center';
    for(let row=0;row<5;row++)for(let i=0;i<9;i++){
      const x=80+182*i+42*Math.sin(row*3+i),y=350+row*422+22*Math.sin(i*2);
      if(heightMap.sample(x,y)<45)continue;
      ctx.fillStyle='rgba(49,67,94,'+(.07+.042*Math.sin(i*3+row+time))+')';
      ctx.fillText(glyphs[(i+row*3+(time<4.5?0:2))%glyphs.length],x,y);
    }
    const p=topoLayout.printMark;
    ctx.font='italic 90px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';
    if(this.printAge<1.4){
      ctx.fillStyle=this.printAge>=0?'#545e69':'#8c9aac';
      ctx.fillText(this.printAge>=0?'а':'ъ',p.x,p.y+5);
      if(this.printAge>=0){
        ctx.font='italic 58px Georgia, serif';
        ctx.fillText('оттиск',p.x-139,p.y+8);
      }
    }
    ctx.restore();
  }
  drawOverlay(){
    if(!started)return;
    const phase=(this.time%4.5)/4.5;
    if(phase>.56)return;
    const y=reduced.matches?1180:290+phase*2880;
    const g=ctx.createLinearGradient(0,y-65,0,y+66);
    g.addColorStop(0,'rgba(39,49,67,0)');g.addColorStop(.45,'rgba(39,49,67,.15)');
    g.addColorStop(.52,'rgba(39,49,67,.18)');g.addColorStop(1,'rgba(39,49,67,0)');
    ctx.fillStyle=g;ctx.fillRect(-850,y-65,3240,131);
    ctx.fillStyle='rgba(54,66,83,.17)';ctx.fillRect(-850,y+4,3240,2);
  }
}

class PaperCompanion {
  constructor(point,awake=true){
    Object.assign(this,point);
    this.vx=0;this.vy=0;this.direction=0;this.radius=13.4;
    this.awake=awake?1:0;this.path=[];this.trail=[];this.hide=false;
    this.flattened=awake?0:1;
    this.safe={...point};this.stall=0;
  }
  setPath(points){this.path=points.slice();this.stall=0;}
  visible(point){
    const dx=point.x-this.x,dy=point.y-this.y;
    const count=Math.ceil(Math.hypot(dx,dy)/16);
    for(let i=1;i<=count;i++){
      if(heightMap.coreContact(this.x+dx*i/count,this.y+dy*i/count,this.radius).value>0)return false;
    }
    return true;
  }
  follow(actor,hide){
    this.hide=hide;
    const last=this.trail.at(-1);
    if(!last||!nearPoint(actor,last,36))this.trail.push({x:actor.x,y:actor.y});
    if(hide){
      this.move(this.visible(this.safe)?this.safe:this);
      return;
    }
    if(nearPoint(this,actor,73)&&this.visible(actor)){
      this.trail.length=0;this.move(this);return;
    }
    for(let i=this.trail.length-1;i>=0;i--){
      const p=this.trail[i];
      if(!nearPoint(this,p,320)||!this.visible(p))continue;
      this.trail.splice(0,i);
      if(nearPoint(this,p,24)&&this.trail.length>1)this.trail.shift();
      this.move(this.trail[0]);return;
    }
    this.move(this.trail[0]||this.safe);
  }
  move(point,field=heightMap){
    const dx=point.x-this.x,dy=point.y-this.y,dist=Math.hypot(dx,dy);
    const drive=Math.min(5.5,252/Math.max(dist,1));
    const ease=1-Math.exp(-7*stepTime);
    this.vx+=(dx*drive-this.vx)*ease;
    this.vy+=(dy*drive-this.vy)*ease;
    const next={x:this.x+this.vx*stepTime,y:this.y+this.vy*stepTime};
    field.collide(next,this.radius);
    const change=Math.hypot(next.x-this.x,next.y-this.y);
    this.vx=(next.x-this.x)/stepTime;this.vy=(next.y-this.y)/stepTime;
    if(change>.12)this.direction=Math.atan2(this.vy,this.vx);
    this.x=next.x;this.y=next.y;
    if(change<.035&&dist>22)this.stall+=stepTime;else this.stall=0;
  }
  walk(field=heightMap){
    const inRoom=point=>point.onPaper?field.warp.inRoom(point):point;
    if(this.path[0]&&nearPoint(this,inRoom(this.path[0]),9)){
      this.safe={...this.path.shift()};
      this.stall=0;
    }
    this.move(inRoom(this.path[0]||this.safe),field);
    if(this.stall>1.15){
      // A section can close before the companion enters. Retreat to its last
      // reached point, on the same side of the obstruction, and try again.
      const safe=inRoom(this.safe);
      this.x=safe.x;this.y=safe.y;this.vx=0;this.vy=0;this.stall=0;
    }
  }
  draw(){
    const fading=flowTime===null?0:clamp((flowTime-.07)/.93,0,1);
    if(fading>=1)return;
    const travel=fading*fading;
    const x=this.x+(well.x-this.x)*travel;
    const y=this.y+(well.y-this.y)*travel;
    const size=(1-fading)*this.radius, speed=Math.hypot(this.vx,this.vy);
    const stretch=1+Math.min(speed/600,.32)+this.flattened*.46;
    ctx.save();ctx.translate(x,y);ctx.rotate(this.direction);
    oval(ctx,1,3,size*stretch,size*.88/stretch,'rgba(31,33,26,.17)');
    oval(ctx,0,-2,size*stretch,size/stretch,'#162119');
    if(this.awake>.02){
      const blink=.4+.6*clamp(Math.abs(Math.sin(elapsed*1.14)),0,1);
      oval(ctx,size*.31,-2,size*.18,Math.max(.08,size*.18*this.awake*blink),'#fff9e5');
    }
    ctx.restore();
  }
}

class StrangerMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.companion=new PaperCompanion(topoLayout.captive,false);
    this.released=false;this.charge=0;
  }
  advance(){
    const companion=this.companion;
    const wake=nearPoint(drop,companion,190)||this.released;
    companion.awake=clamp(companion.awake+(wake?2.3:-.7)*stepTime,0,1);
    if(!this.released){
      const cup=cupLoads[0]>=topoLayout.cupRequired;
      const heavy=nearPoint(drop,plate,43)&&drop.ink>=topoLayout.bodyRequired;
      this.charge=clamp(this.charge+(cup&&heavy?stepTime:-stepTime*3),0,.62);
      if(this.charge>=.62){
        this.released=true;
        companion.setPath([{x:710,y:1410},...chapterPath(heightMap.gatePath),topoLayout.waitAt]);
        sound.play('companion');ripple(companion.x,companion.y,40,'#9c7452');
      }
    }
    gateOpening=this.channel(gateOpening,this.released,heightMap.gatePath);
    if(this.released){
      companion.flattened=Math.max(0,1-gateOpening*2.4);
      if(gateOpening>.72)companion.walk();
    }
    this.setExit(this.released&&nearPoint(companion,topoLayout.waitAt,28));
  }
  get goal(){
    if(unlocked)return 'Капля ждёт у выхода.';
    if(this.released)return 'Прижим поднят.';
    return this.companion.awake>.5?'Под прижимом открылся глаз.':'На бумаге остались пробные отпечатки.';
  }
  get message(){
    if(unlocked)return 'Подойдите к выходу. Капля уйдёт вместе с вами.';
    if(this.released)return 'Следуйте за каплей.';
    return cupLoads[0]>=topoLayout.cupRequired?
      'Чаша держит первый рычаг. Нажмите соседнюю плиту тяжёлым телом.':
      'Оставьте часть чернил в чаше. Второму рычагу нужен вес вашего тела.';
  }
  drawFloor(){
    const inked=cupLoads[0]>=topoLayout.cupRequired;
    chapterTrace([topoLayout.mechanismWire[0]],inked?rust:'#a1937b');
    chapterTrace([topoLayout.mechanismWire[1]],this.released?rust:'#a1937b');
    chapterTrace(topoLayout.exitWire,unlocked?rust:'#a1937b');
    chapterContact(topoLayout.cups[0],inked,cupLoads[0]/topoLayout.cupRequired,44);
    chapterContact(plate,this.released,this.charge/.62,39);
    for(const [x,y,r] of [[382,950,34],[425,1005,24],[766,1040,26],[525,1190,42],[855,1250,28],[468,1300,17]]){
      oval(ctx,x+3,y+2,r+3,r*.84,'rgba(60,52,41,.08)');
      oval(ctx,x,y,r,r*.83,'rgba(60,52,41,.25)');
      ring(x,y,r+7,'rgba(60,52,41,.16)',.8);
      ctx.strokeStyle='rgba(72,64,50,.2)';ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(x-13,y+2);ctx.quadraticCurveTo(x,y-5,x+13,y+1);ctx.stroke();
    }
  }
  drawOverlay(){
    const p=topoLayout.captive;
    const lift=this.released?gateOpening:0,dy=-lift*75;
    ctx.save();
    ctx.globalAlpha=1-.35*lift;
    oval(ctx,p.x,p.y+20,59,21,'rgba(52,42,30,.18)');
    ctx.translate(p.x,p.y+dy);
    ctx.fillStyle='#7b6954';ctx.fillRect(-52,-27,104,18);
    ctx.fillStyle='#b1a18a';ctx.fillRect(-51,-30,102,10);
    for(let i=-44;i<=44;i+=11){
      ctx.fillStyle='#84715c';ctx.fillRect(i,-27,3,13);
    }
    ring(-49,-24,4,'#e2d3b8',1);ring(49,-24,4,'#e2d3b8',1);
    ctx.restore();
  }
}

class TogetherMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
    this.assignment=false;
    this.arrived=false;
    this.blocked=false;
    this.holding=false;
    this.lastSignal=-1;
  }
  advance(){
    if(started)this.time+=stepTime;
    const phase=this.time%7.6,cycle=Math.floor(this.time/7.6);
    const companion=this.companion;
    const vibration=phase>5.55&&phase<6.9&&companion.y<945;
    if(vibration&&this.lastSignal!==cycle){
      this.lastSignal=cycle;sound.play('rollerWarn');
    }
    const refuges=topoLayout.refuges.map(fromPair);
    for(const refuge of refuges)if(nearPoint(companion,refuge,103)&&companion.visible(refuge))companion.safe=refuge;
    this.holding=nearPoint(drop,plate,48)&&drop.ink>=topoLayout.bodyRequired;
    const lane=topoLayout.lowerGate.points[0][0];
    this.blocked=this.holding&&drop.x-lane<drop.bodyRadius+companion.radius+5;
    if(!this.assignment&&this.holding&&!this.blocked&&nearPoint(companion,plate,220)){
      this.assignment=true;
      const entrance={x:lane,y:1285};
      companion.setPath([entrance,...chapterPath(heightMap.lowerGatePath),topoLayout.pilot]);
      sound.play('open');ripple(plate.x,plate.y,46,rust);
    }
    const inChannel=this.assignment&&companion.y>=1300&&companion.y<1690;
    lowerOpening=this.channel(lowerOpening,this.holding||inChannel,heightMap.lowerGatePath);
    if(!this.assignment)companion.follow(drop,vibration);
    else if(this.arrived||(lowerOpening>.68&&this.holding&&(!this.blocked||inChannel)))companion.walk();
    else companion.move(companion);
    if(!this.arrived&&nearPoint(companion,topoLayout.pilot,17)){
      this.arrived=true;
      companion.setPath([topoLayout.waitAt]);
      sound.play('companion');ripple(companion.x,companion.y,27,rust);
    }
    gateOpening=this.channel(gateOpening,this.arrived,heightMap.gatePath);
    this.setExit(this.arrived&&nearPoint(companion,topoLayout.waitAt,38));
  }
  get shake(){return this.companion.hide?1.55:0;}
  get goal(){
    if(unlocked)return 'Дорога открыта для обоих.';
    if(this.arrived)return 'Капля нажала дальнюю чашу.';
    if(this.assignment)return 'Капля идёт через узкую прорезь.';
    if(this.blocked)return 'Тяжёлое тело перекрыло прорезь.';
    if(this.companion.hide)return 'Капля пережидает вибрацию.';
    return drop.y>910?'Привод держит узкую створку.':'Капля следует за вами.';
  }
  get message(){
    if(unlocked)return 'Встретьтесь у отверстия и уйдите вместе.';
    if(this.arrived)return 'Вам открыт широкий проход слева.';
    if(this.assignment)return 'Удерживайте плиту, пока капля не доберётся до чаши.';
    if(this.blocked)return 'Оставайтесь на плите, но сместитесь к её правому краю.';
    if(this.companion.hide)return 'Подождите на спокойном участке, пока капля выйдет из углубления.';
    return 'Нажмите большую плиту тяжёлым телом. Оставьте прорезь свободной для капли.';
  }
  drawFloor(){
    chapterTrace(topoLayout.mechanismWire,this.holding?rust:'#859481');
    chapterTrace([topoLayout.lowerGate.points],this.assignment?'#668a70':'#9ca894');
    chapterTrace([topoLayout.gate.points],this.arrived?rust:'#859481');
    chapterTrace(topoLayout.exitWire,this.arrived?rust:'#859481');
    chapterContact(plate,this.holding,Number(this.holding),44);
    chapterContact(topoLayout.pilot,this.arrived,Number(this.arrived),18);
    const x=plate.x+29,y=plate.y;
    ctx.beginPath();ctx.moveTo(x-11,y-18);ctx.lineTo(x+4,y);ctx.lineTo(x-11,y+18);
    ctx.lineWidth=2;ctx.strokeStyle=this.holding&&!this.blocked?rust:'#7f6555';ctx.stroke();
    for(const point of topoLayout.refuges.map(fromPair)){
      ring(point.x,point.y,38,'rgba(84,113,86,.36)',1);
      ring(point.x,point.y,45,'rgba(84,113,86,.2)',1);
    }
  }
  drawOverlay(){
    if(!this.companion.hide)return;
    const shade=ctx.createLinearGradient(0,580,0,930);
    shade.addColorStop(0,'rgba(44,62,44,0)');
    shade.addColorStop(.42,'rgba(44,62,44,.12)');
    shade.addColorStop(1,'rgba(44,62,44,0)');
    ctx.fillStyle=shade;ctx.fillRect(-850,580,3230,350);
  }
}

const laterChapters={
  6:BracketMechanism,7:WetPaperMechanism,8:OverprintMechanism,
  9:StrangerMechanism,10:TogetherMechanism
};
