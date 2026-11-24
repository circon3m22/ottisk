'use strict';

function atThreshold(point,amount,range=39){
  return nearPoint(drop,point,range)&&drop.ink>=amount;
}

function drawRoller(x,y,width,depth,lift=0){
  const raised=y-lift;
  ctx.save();
  ctx.globalAlpha=.18;
  oval(ctx,x+12,y+depth*.7,width*.53,depth*.6,'#473e3b');
  ctx.globalAlpha=1;
  const finish=ctx.createLinearGradient(0,raised-depth,0,raised+depth);
  finish.addColorStop(0,'#524b45');
  finish.addColorStop(.27,'#ac9e85');
  finish.addColorStop(.52,'#c3b397');
  finish.addColorStop(1,'#5d5348');
  ctx.fillStyle=finish;ctx.beginPath();
  ctx.roundRect(x-width/2,raised-depth,width,depth*2,depth*.6);ctx.fill();
  ctx.lineWidth=1;ctx.strokeStyle='rgba(69,61,51,.42)';
  for(let i=-width/2+10;i<width/2-6;i+=19){
    ctx.beginPath();ctx.moveTo(x+i,raised-depth*.78);ctx.lineTo(x+i,raised+depth*.78);ctx.stroke();
  }
  ctx.strokeStyle='rgba(251,233,195,.45)';
  ctx.beginPath();ctx.moveTo(x-width/2+10,raised-depth*.24);ctx.lineTo(x+width/2-10,raised-depth*.24);ctx.stroke();
  ctx.restore();
}

class LayerMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.layer='surface';
    this.pools={surface:[],under:[]};
    this.topLoad=0;
    this.hatchLock=null;
    this.latched=false;
    this.powered=false;
    this.flash=0;
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
  }
  get inkReceivers(){return this.layer==='surface'?topoLayout.cups:[];}
  transfer(hatch){
    this.pools[this.layer]=inkPools;
    this.layer=this.layer==='surface'?'under':'surface';
    inkPools=this.pools[this.layer];
    heightMap=this.layer==='under'?undersideMap:surfaceMap;
    gateOpening=heightMap.opening;
    this.hatchLock=hatch;this.flash=1;
    drop.clearCore=null;
    sound.play('fold');ripple(hatch.x,hatch.y,40,'#6c827e');
  }
  advance(){
    this.flash=Math.max(0,this.flash-stepTime*2.1);
    if(this.hatchLock&&!nearPoint(drop,this.hatchLock,64))this.hatchLock=null;
    if(this.layer==='surface')this.topLoad=cupLoads[0];
    const above=this.layer==='surface';
    const active=above?this.latched:this.latched||this.topLoad>=topoLayout.cupRequired;
    gateOpening=this.channel(gateOpening,active,heightMap.gatePath);
    if(!above&&!this.latched&&nearPoint(drop,topoLayout.underLatch,36)){
      this.latched=true;
      sound.play('open');ripple(drop.x,drop.y,33,'#659179');
      this.companion.setPath([{x:960,y:960},...chapterPath(surfaceMap.gatePath),{x:800,y:2140}]);
    }
    if(!this.hatchLock&&!shedding&&shedAmount===0){
      const hatch=topoLayout.hatches.find(p=>nearPoint(drop,p,32));
      if(hatch)this.transfer(hatch);
    }
    if(this.layer==='surface'){
      if(this.latched&&gateOpening>.85)this.companion.walk();
      else if(!this.latched)this.companion.follow(drop,false);
      if(this.latched&&!this.powered&&atThreshold(plate,topoLayout.bodyRequired)){
        this.powered=true;sound.play('circuit');
      }
    }else if(this.latched){
      // Let the companion cross the upper bridge even while we are below.
      // The animation clock is shared but its walls are not.
      surfaceMap.setOpenings(1,0);
      this.companion.walk(surfaceMap);
    }else{
      this.companion.move({x:clamp(drop.x+42,458,755),y:clamp(drop.y-65,720,910)},surfaceMap);
    }
    // The iris belongs to the upper sheet, even directly over a lower corridor.
    this.setExit(this.layer==='surface'&&this.powered&&nearPoint(this.companion,{x:800,y:2140},42));
  }
  get goal(){
    if(unlocked)return 'Верхний выход открыт.';
    if(this.powered)return 'Спутник идёт к отверстию.';
    if(this.latched)return 'Складка зафиксирована. Верхняя сторона доступна.';
    if(this.layer==='under')return this.topLoad>=topoLayout.cupRequired?'Край бумаги опустился.':'Снизу видна закрытая складка.';
    return 'Круглое отверстие ведёт под бумагу.';
  }
  get message(){
    if(unlocked)return 'Встретьтесь со спутником у отверстия в верхнем листе.';
    if(this.latched)return 'Верните чернила сверху и нажмите нижнюю плиту тяжёлым телом.';
    if(this.layer==='under'&&this.topLoad>=topoLayout.cupRequired)return 'Перейдите снизу и зафиксируйте складку у второго отверстия.';
    return 'Оставьте чернила в верхней чаше, затем войдите в круглое отверстие.';
  }
  drawFloor(){
    if(this.layer==='surface'){
      const loaded=this.topLoad>=topoLayout.cupRequired;
      chapterContact(topoLayout.cups[0],loaded,this.topLoad/topoLayout.cupRequired,43);
      chapterTrace(topoLayout.mechanismWire,this.latched?rust:'#81917c');
      chapterContact(plate,this.powered,Number(this.powered),32);
      chapterTrace(topoLayout.exitWire,this.powered?rust:'#81917c');
    }else{
      chapterTrace([topoLayout.underside.gate.points],this.topLoad>=topoLayout.cupRequired||this.latched?'#56857c':'#83999c',2);
      chapterContact(topoLayout.underLatch,this.latched,Number(this.latched),32);
      ctx.save();ctx.filter='blur(9px)';
      const friend=this.companion;
      oval(ctx,friend.x,friend.y,22,17,'rgba(56,68,67,.34)');
      ctx.restore();
    }
    for(const hatch of topoLayout.hatches){
      if(heightMap.sample(hatch.x,hatch.y)>0)continue;
      const {x,y}=hatch;
      oval(ctx,x+2,y+4,45,38,'rgba(33,52,48,.18)');
      oval(ctx,x,y,41,35,this.layer==='under'?'#d0dccc':'#618177');
      oval(ctx,x,y-1,32,26,this.layer==='under'?'#eceddb':'#263c35');
      ring(x,y,38,'#8ea193',1.7);ring(x,y,49,'rgba(91,121,109,.45)',1);
      for(let i=0;i<3;i++)ring(x,y,18+i*4,this.layer==='under'?'#9faf9d':'rgba(199,217,192,.25)',.8,Math.PI*.1,Math.PI*1.5);
    }
  }
  drawOverlay(){
    if(!this.flash||reduced.matches)return;
    const hatch=this.hatchLock;
    if(!hatch)return;
    const r=(1-this.flash)*110+37;
    ring(hatch.x,hatch.y,r,'rgba(219,232,214,'+this.flash*.65+')',2);
  }
}

class FeedMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
    this.assigned=false;this.feedTime=0;this.running=false;this.stopped=false;
    this.rest={x:804,y:2130};
  }
  advance(){
    gateOpening=this.channel(gateOpening,weight.seated,heightMap.gatePath);
    if(weight.seated&&gateOpening>.85&&!this.assigned){
      this.assigned=true;
      this.companion.setPath([{x:640,y:1100,onPaper:true},...chapterPath(heightMap.gatePath),this.rest]);
    }
    if(this.assigned)this.companion.walk();else this.companion.follow(drop,false);
    if(weight.seated&&!this.running&&!this.stopped&&nearPoint(drop,plate,39)){
      this.running=true;sound.play('feed');ripple(plate.x,plate.y,45,rust);
    }
    if(this.running){
      this.feedTime+=stepTime;
      this.feedDistance+=53*stepTime;
      if(this.feedTime>=3.2){
        this.running=false;this.stopped=true;sound.play('rollerWarn');
      }
    }
    this.setExit(this.stopped&&nearPoint(this.companion,this.rest,38));
  }
  get shake(){return this.running?1.35:0;}
  get goal(){
    if(unlocked)return 'Подача остановилась у полосы света.';
    if(this.running)return 'Ролики тянут лист к свету.';
    if(this.stopped)return 'Спутник подходит к выходу.';
    return weight.seated?'Поднятый прижим освободил край листа.':'Край листа зажат роликами.';
  }
  get message(){
    if(unlocked)return 'Отверстие находится у полосы света.';
    if(this.running||this.stopped)return this.goal;
    if(!weight.seated)return 'Наберите вес и прокатите медный груз до гнезда прижима.';
    return drop.y<1700?'Уменьшитесь. Вдоль края листа открылся узкий проход.':'Нажмите контакт подачи внизу.';
  }
  drawFloor(){
    chapterTrace(topoLayout.mechanismWire,weight.seated?rust:'#938471');
    chapterRail(weight.rail);chapterContact(socket,weight.seated,Number(weight.seated),42);
    chapterContact(plate,this.running||this.stopped,clamp(this.feedTime/3.2,0,1),35);
    chapterTrace(topoLayout.exitWire,this.stopped?rust:'#938471');
  }
  drawOverlay(){
    const offset=sheetOffset();
    drawRoller(700,1120-offset,565,21,weight.seated?48:0);
    drawRoller(710,1890-offset,750,28,this.running?8:0);
    const y=2350-offset;
    const light=ctx.createLinearGradient(0,y-220,0,y+60);
    light.addColorStop(0,'rgba(255,250,219,0)');
    light.addColorStop(1,'rgba(255,253,224,.77)');
    ctx.fillStyle=light;ctx.fillRect(-850,y-220,3200,280);
  }
}

class FlushMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.companion=new PaperCompanion(topoLayout.captive,false);
    this.waitAt={x:917,y:2300};
    this.suction=0;this.redirected=false;this.flushAge=0;
    this.tankInk=0;this.warned=false;this.sent=false;
  }
  // Move nearby ink and the soft body through the same suction field.
  beforeStep(){
    if(this.redirected)return;
    if(drop.y>685||this.suction>0)this.suction=Math.min(1,this.suction+stepTime*.42);
    if(this.suction>.2&&!this.warned){this.warned=true;sound.play('suction');}
    const drain=topoLayout.drain;
    const push=(p,force)=>{
      const dx=drain.x-p.x,dy=drain.y-p.y,dist=Math.hypot(dx,dy);
      if(dist<1||dist>440)return;
      const strength=(1-dist/440)*this.suction*force*stepTime/dist;
      p.vx+=dx*strength;p.vy+=dy*strength;
    };
    const force=drop.ink>=.50?280:2600*(1-drop.ink);
    push(drop,force);
    for(const node of drop.nodes)push(node,force);
    for(const pool of inkPools){
      if(nearPoint(pool,drain,35)&&this.suction>.2){
        this.tankInk+=pool.amount;pool.amount=0;
      }else push(pool,690);
    }
    inkPools=inkPools.filter(pool=>pool.amount>0);
  }
  advance(){
    if(!this.redirected&&this.suction>.72&&drop.ink<.36&&nearPoint(drop,topoLayout.drain,35)){
      this.rewind={age:0,ink:drop.ink+shedAmount,x:drop.x,y:drop.y};
      this.hits++;
      sound.play('suction');return;
    }
    if(!this.redirected&&atThreshold(plate,.50)){
      this.redirected=true;sound.play('seal');ripple(plate.x,plate.y,32,'#668b7b');
    }
    if(this.redirected){
      const previous=this.flushAge;
      this.flushAge+=stepTime;
      this.suction=Math.max(0,this.suction-stepTime*.9);
      if(previous<.9&&this.flushAge>=.9){
        const p=topoLayout.tank;
        if(this.tankInk>0)inkPools.push(new InkDrop(p.x,p.y,0,this.tankInk));
        this.tankInk=0;sound.play('open');ripple(p.x,p.y,42,'#668b7b');
      }
    }
    gateOpening=this.channel(gateOpening,this.flushAge>=.9,heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,weight.seated,heightMap.lowerGatePath);
    this.companion.awake=clamp((drop.y-1830)/410,0,1);
    if(weight.seated&&lowerOpening>.85&&!this.sent){
      this.sent=true;this.companion.setPath([this.waitAt]);sound.play('companion');
    }
    if(this.sent)this.companion.walk();
    this.setExit(this.sent&&nearPoint(this.companion,this.waitAt,35));
  }
  recover(){
    this.rewind.age+=stepTime;
    if(this.rewind.age<.62)return;
    const saved=this.rewind;
    drop=new Drop(820,438,saved.ink);
    this.rewind=null;this.suction=0;this.warned=false;
    shedding=false;shedAmount=0;shedTime=0;keys.clear();stopPointer();
    ripple(drop.x,drop.y,30,'#668b7b');
  }
  get goal(){
    if(unlocked)return 'Решётка поднята. Спутник ждёт впереди.';
    if(this.flushAge>=.9)return 'Резервуар открыт. Боковой груз удерживает решётку.';
    if(this.redirected)return 'Поток идёт в резервуар.';
    if(this.suction>.55)return 'Тяга у слива усилилась.';
    return 'Открылись сливные отверстия.';
  }
  get message(){
    if(this.rewind)return 'Слив отбросил мышку в безопасное углубление.';
    if(unlocked)return 'Дойдите до выхода вместе со спутником.';
    if(this.flushAge>=.9)return 'Заберите чернила из резервуара и сдвиньте груз до гнезда.';
    return 'Впитайте капли вокруг слива. Тяжёлое тело удержится на правой заслонке.';
  }
  drawFloor(){
    chapterTrace(topoLayout.mechanismWire,this.redirected?rust:'#6f9488');
    chapterContact(plate,this.redirected,Number(this.redirected),40);
    chapterRail(weight.rail);chapterContact(socket,weight.seated,Number(weight.seated),42);
    chapterTrace(topoLayout.exitWire,weight.seated?rust:'#6f9488');
    const drain=topoLayout.drain,tank=topoLayout.tank;
    oval(ctx,drain.x,drain.y,52,44,'#465f58');
    oval(ctx,drain.x,drain.y,43,35,'#203b36');
    ring(drain.x,drain.y,58,'#739185',1.6);
    for(let i=0;i<5;i++)ring(drain.x,drain.y,14+i*6,'rgba(145,187,171,.64)',1,elapsed*(1+i*.28),elapsed*(1+i*.28)+Math.PI*1.22);
    oval(ctx,tank.x,tank.y,60,50,'#81a595');
    oval(ctx,tank.x,tank.y,51,42,'#c1d8c7');
    oval(ctx,tank.x,tank.y,20+this.tankInk*30,11+this.tankInk*20,'#516e5c');
    ring(tank.x,tank.y,56,'#526f65',2);
    if(!this.sent){
      const p=topoLayout.captive;
      ctx.strokeStyle='#59675d';ctx.lineWidth=3.2;
      for(let i=-4;i<=4;i++){ctx.beginPath();ctx.moveTo(p.x+i*10,p.y-30);ctx.lineTo(p.x+i*10,p.y+21);ctx.stroke();}
      ring(p.x,p.y,56,'#6f887b',1.5);
    }
  }
  drawOverlay(){
    if(this.redirected&&this.flushAge>1.5)return;
    const origin=this.redirected?topoLayout.tank:topoLayout.drain;
    ctx.lineWidth=1.1;ctx.strokeStyle='rgba(73,128,115,.43)';
    for(let i=0;i<24;i++){
      const angle=i*2.399;
      const phase=(i*.618+elapsed*(this.redirected?.89:.29))%1;
      const distance=35+(1-phase)*320;
      const x=origin.x+Math.cos(angle)*distance,y=origin.y+Math.sin(angle)*distance*.67;
      if(heightMap.sample(x,y)>1)continue;
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x-9,y+8,x-Math.cos(angle)*18,y-Math.sin(angle)*18);
      ctx.stroke();
    }
  }
}


class WhiteBandMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.fixed=[false,false];
    this.viewTime=0;this.hasViewed=false;this.powered=false;this.sent=false;
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
  }
  advance(){
    if(!this.hasViewed&&!reduced.matches&&nearPoint(drop,topoLayout.lookout,62)){
      this.viewTime=3.2;
      this.hasViewed=true;
    }
    this.viewTime=Math.max(0,this.viewTime-stepTime);
    const charged=cupLoads.map(amount=>amount>=topoLayout.cupRequired);
    gateOpening=this.channel(gateOpening,this.fixed[0]||charged[0],heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,this.fixed[1]||charged[1],heightMap.lowerGatePath);
    topoLayout.fixPoints.forEach((point,index)=>{
      const gap=index===0?gateOpening:lowerOpening;
      if(!this.fixed[index]&&gap>.8&&nearPoint(drop,point,38)){
        this.fixed[index]=true;sound.play('seat');ripple(point.x,point.y,36,rust);
      }
    });
    if(this.fixed.every(Boolean)&&!this.powered&&atThreshold(plate,topoLayout.bodyRequired)){
      this.powered=true;sound.play('circuit');
    }
    if(this.powered&&this.companion.y>2090&&!this.sent){
      this.sent=true;this.companion.setPath([topoLayout.waitAt]);
    }
    if(this.sent)this.companion.walk();else this.companion.follow(drop,false);
    this.setExit(this.sent&&nearPoint(this.companion,topoLayout.waitAt,34));
  }
  get cameraView(){return this.viewTime>0?{y:1320,zoom:.43}:null;}
  get goal(){
    if(unlocked)return 'Спутник уже у края бумаги.';
    if(this.powered)return 'Последний контакт замкнут.';
    if(this.fixed[1])return 'Оба обхода зафиксированы.';
    if(this.fixed[0])return 'Первый обход остаётся открытым.';
    return 'На белой полосе видны два обхода.';
  }
  get message(){
    if(unlocked)return 'Подойдите к отверстию рядом со спутником.';
    if(this.fixed[1])return 'Заберите чернила из второй чаши и нажмите плиту у края.';
    if(this.fixed[0])return 'Верните чернила из первой чаши. Используйте их во второй и зафиксируйте следующий обход.';
    return 'Соберите чернила у верхнего кармана, заполните чашу и нажмите контакт на другой стороне.';
  }
  drawFloor(){
    const curves=topoLayout.mechanismWire;
    for(let i=0;i<2;i++){
      const p=topoLayout.cups[i];
      const amount=cupLoads[i]/topoLayout.cupRequired;
      chapterTrace(curves.slice(i*2,i*2+2),amount>=1||this.fixed[i]?rust:'#aaa28b');
      chapterContact(p,amount>=1,amount,46);
      chapterContact(topoLayout.fixPoints[i],this.fixed[i]);
    }
    const p=topoLayout.lookout;
    ring(p.x,p.y,33,'#b0a589',1);
    ctx.beginPath();ctx.arc(p.x,p.y,20,Math.PI*.16,Math.PI*.84);
    ctx.strokeStyle='#a89b7e';ctx.stroke();
    chapterContact(plate,this.powered,Number(this.powered),36);
    chapterTrace(topoLayout.exitWire,this.powered?rust:'#aaa28b');
  }
  drawOverlay(){
    const alpha=clamp((drop.y-1880)/530,0,.26);
    if(alpha<=0)return;
    const g=ctx.createLinearGradient(1170,0,1520,0);
    g.addColorStop(0,'rgba(96,73,60,0)');
    g.addColorStop(1,'rgba(96,73,60,'+alpha+')');
    ctx.save();
    ctx.fillStyle=g;
    ctx.beginPath();ctx.moveTo(1700,1940);
    ctx.bezierCurveTo(1540,1920,1465,2020,1350,2024);
    ctx.bezierCurveTo(1230,2028,1175,2090,1240,2115);
    ctx.bezierCurveTo(1340,2130,1435,2080,1475,2135);
    ctx.bezierCurveTo(1430,2170,1260,2200,1235,2250);
    ctx.bezierCurveTo(1210,2320,1390,2270,1475,2280);
    ctx.bezierCurveTo(1490,2390,1610,2430,1700,2410);
    ctx.closePath();ctx.fill();ctx.restore();
  }
}

class MisprintMechanism extends PrintMechanisms {
  constructor(){
    super();
    const rail=topoLayout.secondRail;
    this.weights=[new Counterweight({rail:createRail(rail.start,rail.finish)})];
    this.hold=false;this.connected=false;this.bridgeLatched=false;this.awakened=false;this.wakeTime=0;
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
    this.crew=topoLayout.kin.map((p,i)=>{
      const actor=new PaperCompanion(p,false);
      actor.radius=10+i*1.45;
      return actor;
    });
  }
  get second(){return this.weights[0];}
  advance(){
    const circuit=topoLayout.circuits[0],half=circuit.gap/2;
    const wet=inkConnection({x:circuit.x-half,y:circuit.y},{x:circuit.x+half,y:circuit.y},inkPools);
    if(wet&&!this.connected){sound.play('circuit');ripple(circuit.x,circuit.y,23,rust);}
    this.connected=wet;
    // A lock on the far bank keeps the first path open once it has been crossed.
    // Leaving the bridge early must still let the player return to the ink.
    if(!this.bridgeLatched&&weight.seated&&gateOpening>.85&&drop.y>1390){
      this.bridgeLatched=true;
      sound.play('seat');ripple(drop.x,drop.y,26,'#906e79');
    }
    gateOpening=this.channel(gateOpening,weight.seated&&(wet||this.bridgeLatched),heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,this.hold,heightMap.lowerGatePath);
    if(!this.hold&&this.bridgeLatched&&nearPoint(drop,plate,39)){
      this.hold=true;sound.play('seat');ripple(plate.x,plate.y,42,rust);
    }
    this.companion.follow(drop,false);
    if(this.second.seated&&!this.awakened){
      this.awakened=true;
      sound.play('companion');ripple(socket.x,socket.y,44,'#8d7180');
      this.crew.forEach((actor,i)=>actor.setPath([{x:well.x+(i-1)*49,y:well.y-48-i*17}]));
    }
    if(this.awakened){
      this.wakeTime+=stepTime;
      for(const actor of this.crew){actor.awake=clamp(this.wakeTime*2,0,1);actor.walk();}
    }
    this.setExit(this.awakened&&this.crew.every(actor=>nearPoint(actor,well,145)));
  }
  get goal(){
    if(this.awakened)return 'Старые кляксы ожили.';
    if(this.hold)return 'Широкий обход зафиксирован.';
    if(gateOpening>.85)return 'Линия проводит. Вдали виден второй груз.';
    return weight.seated?'За прижимом разорвана печатная линия.':'Головка остановила лист.';
  }
  get message(){
    if(this.awakened)return 'Пройдите к отверстию рядом с ожившими каплями.';
    if(this.hold)return 'Вернитесь за оставленным запасом и сдвиньте второй груз по направляющей.';
    if(gateOpening>.85)return 'Уменьшитесь перед узким проходом и нажмите фиксатор за ним.';
    return weight.seated?'Замкните пару контактов чернилами.':'Установите первый груз в гнездо.';
  }
  drawFloor(){
    const c=topoLayout.circuits[0];
    chapterTrace(topoLayout.mechanismWire.slice(0,3),this.connected||this.bridgeLatched?rust:'#a38b91');
    chapterTrace([topoLayout.mechanismWire[3]],this.hold?rust:'#a38b91');
    for(const sign of [-1,1])ring(c.x+sign*c.gap/2,c.y,6,'#a66f5e',1.6);
    for(const object of [weight,this.second]){
      chapterRail(object.rail);chapterContact(object.rail.finish,object.seated,Number(object.seated),42);
    }
    chapterContact(plate,this.hold);
    chapterTrace(topoLayout.exitWire,this.awakened?rust:'#a38b91');
  }
  drawOverlay(){
    const lift=clamp(this.wakeTime/.9,0,1);
    drawRoller(660,1220,690,31,104*lift);
    const shade=ctx.createLinearGradient(0,1110,0,1340);
    shade.addColorStop(0,'rgba(60,34,48,0)');
    shade.addColorStop(.47,'rgba(60,34,48,'+(.17-.13*lift)+')');
    shade.addColorStop(1,'rgba(60,34,48,0)');
    ctx.fillStyle=shade;ctx.fillRect(-850,1110,3300,230);
  }
}

class MarginMechanism extends PrintMechanisms {
  constructor(){
    super();
    this.returnOpen=false;this.sent=false;this.running=false;
    this.feedTime=0;this.epilogueTime=-1;this.epilogueFinished=false;
    this.companion=new PaperCompanion(topoLayout.companionSpawn);
    this.crew=topoLayout.kin.map((p,i)=>{
      const actor=new PaperCompanion(p);
      actor.radius=10.4+i*1.5;
      return actor;
    });
    this.party=[this.companion,...this.crew];
  }
  advance(){
    const charged=cupLoads[0]>=topoLayout.cupRequired;
    gateOpening=this.channel(gateOpening,charged||this.returnOpen,heightMap.gatePath);
    lowerOpening=this.channel(lowerOpening,this.returnOpen,heightMap.lowerGatePath);
    if(!this.returnOpen&&gateOpening>.84&&nearPoint(drop,topoLayout.returnLatch,39)){
      this.returnOpen=true;
      sound.play('seat');ripple(drop.x,drop.y,36,rust);
    }
    if(this.returnOpen&&lowerOpening>.9&&!this.sent){
      this.sent=true;
      this.party.forEach((actor,i)=>actor.setPath([
        {x:355,y:910,onPaper:true},
        ...chapterPath(heightMap.lowerGatePath),
        {x:650+i*46,y:2195+i%2*25}
      ]));
      sound.play('companion');
    }
    if(this.sent)for(const actor of this.party)actor.walk();
    else if(drop.y<870)this.companion.follow(drop,false);
    if(this.returnOpen&&!this.running&&atThreshold(plate,topoLayout.bodyRequired)){
      this.running=true;sound.play('feed');
    }
    if(this.running&&this.feedTime<3.4){
      this.feedTime+=stepTime;
      this.feedDistance+=72*stepTime;
    }
    this.setExit(this.running&&this.feedTime>=3.4&&this.party.every(actor=>nearPoint(actor,well,165)));
  }
  get cameraView(){
    if(reduced.matches||!this.running)return null;
    return {y:clamp(drop.y+105,1750,2180),zoom:.84};
  }
  get goal(){
    if(unlocked)return 'Белый просвет открыт.';
    if(this.running)return 'Лист выходит к свету.';
    if(this.returnOpen)return 'Широкий обход открыт для всех.';
    if(cupLoads[0]>=topoLayout.cupRequired)return 'Боковая чаша держит край направляющей.';
    return 'За последней направляющей виден свет.';
  }
  get message(){
    if(unlocked)return 'Подойдите к белому просвету. Все капли уйдут вместе.';
    if(this.running)return 'Дождитесь спутника и остальных капель у края.';
    if(this.returnOpen)return 'Верните запас из боковой чаши и нажмите плиту подачи.';
    return 'Наполните боковую чашу и пройдите уменьшившись. Нажмите фиксатор на той стороне.';
  }
  drawFloor(){
    const charge=cupLoads[0]/topoLayout.cupRequired;
    chapterTrace(topoLayout.mechanismWire.slice(0,2),charge>=1?rust:'#ac9f76');
    chapterTrace([topoLayout.mechanismWire[2]],this.returnOpen?rust:'#ac9f76');
    chapterContact(topoLayout.cups[0],charge>=1,charge,45);
    chapterContact(topoLayout.returnLatch,this.returnOpen);
    chapterContact(plate,this.running,clamp(this.feedTime/3.4,0,1),38);
    chapterTrace(topoLayout.exitWire,this.running?rust:'#ac9f76');
  }
  drawExit(){
    const t=opening*opening*(3-2*opening);
    const size=8+30*t;
    const glow=ctx.createRadialGradient(well.x,well.y,1,well.x,well.y,90);
    glow.addColorStop(0,'rgba(255,253,232,.8)');
    glow.addColorStop(1,'rgba(255,253,232,0)');
    oval(ctx,well.x,well.y,90,79,glow);
    oval(ctx,well.x,well.y,43,37,'#afaa84');
    oval(ctx,well.x,well.y,39,33,'#ded5ad');
    oval(ctx,well.x,well.y,size,size*.85,'#fffdeb');
    for(let i=0;i<4;i++)ring(well.x,well.y,42+i*5,'rgba(142,130,80,'+(.37-i*.065)+')',1.2);
  }
  drawOverlay(){
    const y=2370-clamp(this.feedTime/3.4,0,1)*415;
    const sunlight=ctx.createLinearGradient(0,y-110,0,y+270);
    sunlight.addColorStop(0,'rgba(255,250,216,0)');
    sunlight.addColorStop(.28,'rgba(255,246,199,.26)');
    sunlight.addColorStop(1,'rgba(255,253,237,.76)');
    ctx.fillStyle=sunlight;ctx.fillRect(-850,y-110,3250,2100);
  }
  beginEpilogue(){
    if(this.epilogueTime>=0)return;
    this.epilogueTime=0;
    document.querySelector('#skip-ending')?.classList?.remove('hidden');
    document.querySelector('main')?.classList?.add('ending');
    sound.play('lastPage');
  }
  advanceEpilogue(seconds){
    if(this.epilogueFinished)return;
    const from=this.epilogueTime;
    this.epilogueTime+=seconds;
    if(from<8.2&&this.epilogueTime>=8.2)sound.play('pencil');
    if(from<14.7&&this.epilogueTime>=14.7)sound.play('lantern');
    if(this.epilogueTime>=epilogueDuration)this.finishEpilogue();
  }
  finishEpilogue(){
    if(this.epilogueTime<0||this.epilogueFinished)return;
    this.epilogueTime=epilogueDuration;
    this.epilogueFinished=true;
    document.querySelector('#skip-ending')?.classList?.add('hidden');
    completion.showModal();
  }
}
const finalChapters={
  11:LayerMechanism,12:FeedMechanism,13:FlushMechanism,
  14:WhiteBandMechanism,15:MisprintMechanism,16:MarginMechanism
};
