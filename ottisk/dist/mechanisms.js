'use strict';

function pointInInk(x,y,pool){
  let inside=false;const ns=pool.nodes;
  for(let i=0,j=ns.length-1;i<ns.length;j=i++){
    const a=ns[i],b=ns[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
function inkTouchesContact(pool,contact){
  if(pool.amount<.004)return false;
  if(pointInInk(contact.x,contact.y,pool))return true;
  const ns=pool.nodes,r=contact.radius||6;
  return ns.some((a,i)=>{const b=ns[(i+1)%ns.length],dx=b.x-a.x,dy=b.y-a.y,t=clamp(((contact.x-a.x)*dx+(contact.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(a.x+t*dx-contact.x,a.y+t*dy-contact.y)<=r;});
}
function inkBodiesTouch(a,b){
  if(Math.hypot(a.x-b.x,a.y-b.y)>(Math.sqrt(a.amount)+Math.sqrt(b.amount))*25+12)return false;
  if(pointInInk(a.x,a.y,b)||pointInInk(b.x,b.y,a))return true;
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(let i=0;i<a.nodes.length;i++)for(let j=0;j<b.nodes.length;j++){
    const p=a.nodes[i],q=a.nodes[(i+1)%a.nodes.length],r=b.nodes[j],s=b.nodes[(j+1)%b.nodes.length];
    if(cross(p,q,r)*cross(p,q,s)<0&&cross(r,s,p)*cross(r,s,q)<0)return true;
  }return false;
}
function inkConnection(a,b,pools){
  const live=pools.filter(p=>p.amount>=.004),queue=live.filter(p=>inkTouchesContact(p,a)),visited=new Set(queue);
  while(queue.length){const pool=queue.shift();if(inkTouchesContact(pool,b))return true;for(const other of live)if(!visited.has(other)&&inkBodiesTouch(pool,other)){visited.add(other);queue.push(other);}}
  return false;
}
function sheetOffset(){return levelNumber===4||levelNumber===12||levelNumber===16?-(mechanisms?.feedDistance||0):0;}

class PrintMechanisms {
  constructor(){
    this.time=0;this.links=[false,false,false];this.shutterCharge=0;this.shutterLatched=false;
    this.checkpoint={...spawn};this.rewind=null;this.hits=0;this.warned=new Map();this.revealAge=-1;this.dotFlash=-1;this.balanceReady=false;
    this.firstLatched=false;this.feedDistance=0;this.shutterTimer=0;this.exitSecured=false;this.balanceCharge=0;
  }
  setExit(active){
    if(active&&!unlocked){portalAge=0;sound.play('portal');ripple(well.x,well.y,40,rust);}
    unlocked=active;
    if(!active)opening=Math.max(0,opening-stepTime*1.4);
  }
  channel(current,wanted,path){
    // A returning shutter waits for the body to leave its swept volume.
    if(!wanted&&current>.1){
      const point=heightMap.warp.onPaper(drop);
      if(path.some(s=>heightMap.segmentDistance(point.x,point.y,s)<drop.bodyRadius+7))wanted=true;
    }
    return clamp(current+(wanted?1:-1)*stepTime*.9,0,1);
  }
  rollerPhase(index){return (this.time+topoLayout.rollers[index].offset)%6.4;}
  recover(){
    const r=this.rewind;r.age+=stepTime;this.time+=stepTime;this.feedDistance+=14*stepTime;
    this.shutterTimer=Math.max(0,this.shutterTimer-stepTime);
    const t=clamp((r.age-.18)/.5,0,1),ease=t*t*(3-2*t),squash=Math.sin(Math.PI*clamp(r.age/.36,0,1))*.78;
    const x=r.x+(this.checkpoint.x-r.x)*ease,y=r.y+(this.checkpoint.y-r.y)*ease;
    drop.nodes.forEach((p,i)=>{p.x=x+r.nodes[i].x*(1+squash*.5);p.y=y+r.nodes[i].y*(1-squash);});
    drop.tail.points.forEach((p,i)=>{p.x=x+r.tail[i].x;p.y=y+r.tail[i].y*(1-squash*.5);});drop.center();
    if(t>=1){drop=new Drop(this.checkpoint.x,this.checkpoint.y,r.ink);this.rewind=null;keys.clear();pointer=null;target={x:drop.x,y:drop.y};ripple(drop.x,drop.y,32,'#77775c');}
  }
  advance(){
    const holdingBrake=levelNumber===4&&Math.hypot(drop.x-plate.x,drop.y-plate.y)<42&&drop.ink>=requiredInk&&this.shutterCharge>=.85;
    if(!holdingBrake){this.time+=stepTime;this.feedDistance+=14*stepTime;}
    if(levelNumber===3){
      topoLayout.circuits.forEach((c,i)=>{
        const active=inkConnection({x:c.x-c.gap/2,y:c.y},{x:c.x+c.gap/2,y:c.y},inkPools);
        if(active!==this.links[i]){sound.play(active?'circuit':'plate');ripple(c.x,c.y,18,active?rust:'#727e70');}
        this.links[i]=active;
      });
      if(!this.firstLatched&&this.links[0]&&Math.hypot(drop.x-topoLayout.latch.x,drop.y-topoLayout.latch.y)<34){this.firstLatched=true;sound.play('seat');ripple(topoLayout.latch.x,topoLayout.latch.y,28,rust);}
      gateOpening=this.channel(gateOpening,this.links[0]||this.firstLatched,heightMap.gatePath);
      lowerOpening=this.channel(lowerOpening,this.links[1]&&this.links[2],heightMap.lowerGatePath);
      this.setExit(this.links[1]&&this.links[2]);
    }else if(levelNumber===4){
      for(const point of topoLayout.refuges)if((point[1]<2900||this.exitSecured)&&Math.hypot(drop.x-point[0],drop.y-point[1])<85)this.checkpoint={x:point[0],y:point[1]};
      for(let i=0;i<topoLayout.rollers.length;i++){
        const roller=topoLayout.rollers[i],phase=this.rollerPhase(i),cycle=Math.floor((this.time+roller.offset)/6.4);
        if(phase>4.1&&phase<5.25&&Math.abs(drop.y-roller.y)<500&&this.warned.get(i)!==cycle){this.warned.set(i,cycle);sound.play('rollerWarn');}
        if(phase>=5.25&&phase<6.05&&Math.abs(drop.y-roller.y)<32+drop.bodyRadius*.45&&Math.abs(drop.x-roller.x)<roller.width/2+drop.bodyRadius*.4){
          this.rewind={age:0,x:drop.x,y:drop.y,ink:drop.ink,nodes:drop.nodes.map(p=>({x:p.x-drop.x,y:p.y-drop.y})),tail:drop.tail.points.map(p=>({x:p.x-drop.x,y:p.y-drop.y}))};
          this.hits++;sound.play('rollerPress');return;
        }
      }
      const holding=Math.hypot(drop.x-plate.x,drop.y-plate.y)<42&&drop.ink>=requiredInk;
      if(!this.shutterLatched)this.shutterCharge=clamp(this.shutterCharge+(holding?stepTime:-stepTime*.5),0,.85);
      if(this.shutterCharge>=.85&&!this.shutterLatched){this.shutterLatched=true;sound.play('seal');ripple(plate.x,plate.y,45,rust);}
      if(this.shutterLatched&&holding)this.shutterTimer=7.5;
      else this.shutterTimer=Math.max(0,this.shutterTimer-stepTime);
      if(this.shutterLatched&&drop.y>2970)this.exitSecured=true;
      if(this.shutterLatched&&this.shutterTimer<=0&&!this.exitSecured){
        this.shutterLatched=false;this.shutterCharge=0;
        if(drop.y>2670&&drop.y<2980){this.rewind={age:0,x:drop.x,y:drop.y,ink:drop.ink,reason:'gate',nodes:drop.nodes.map(p=>({x:p.x-drop.x,y:p.y-drop.y})),tail:drop.tail.points.map(p=>({x:p.x-drop.x,y:p.y-drop.y}))};sound.play('rollerPress');return;}
      }
      gateOpening=this.channel(gateOpening,this.shutterLatched||this.exitSecured,heightMap.gatePath);
      this.setExit(this.exitSecured);
      if(drop.y>2960&&this.revealAge<0){this.revealAge=0;sound.play('printer');}
      if(this.revealAge>=0)this.revealAge+=stepTime;
    }else if(levelNumber===5){
      const first=cupLoads[0]>=topoLayout.cupRequired;
      if(!this.balanceReady){
        const second=Math.hypot(drop.x-plate.x,drop.y-plate.y)<44&&drop.ink>=topoLayout.bodyRequired;
        const equilibrium=Math.abs(cupLoads[0]-drop.ink)<=topoLayout.balanceTolerance;
        this.balanceCharge=clamp(this.balanceCharge+(first&&second&&equilibrium?stepTime:-stepTime*3),0,.8);
        // The balance holds the latch. The mouse can then step off the cup
        // and walk all the way to the iris while it opens.
        if(this.balanceCharge>=.8){
          this.balanceReady=true;
          this.dotFlash=0;
          sound.play('circuit');
        }
      }
      gateOpening=this.channel(gateOpening,first||this.balanceReady,heightMap.gatePath);
      if(this.dotFlash>=0)this.dotFlash+=stepTime;
      this.setExit(this.balanceReady);
    }
  }
  get message(){
    if(levelNumber===3){
      if(this.links[1]&&this.links[2])return drop.bodyRadius>35.4?'Цепь замкнута. Для тесного пути оставьте лишние чернила.':'Выход питается чернилами. Следуйте вдоль линии.';
      if(drop.y>1050&&!this.firstLatched)return 'Запаса на все разрывы не хватит. Найдите клемму, удерживающую первый проход.';
      if(this.firstLatched&&this.links[0])return 'Первый проход удерживает клемма. Его чернила теперь можно вернуть.';
      if(this.firstLatched&&!this.links[0])return 'Перераспределите сохранённый запас между двумя нижними разрывами.';
      if(!this.links[0])return 'Линия разорвана. Оставьте чернила между парными контактами.';
      if(drop.y<1100)return 'Перемычка проводит импульс. Пройдите по открывшейся линии.';
      if(!this.links[1]||!this.links[2])return 'Ниже два разрыва одной цепи. Замкните оба и сохраните перемычки.';
      return 'Следуйте по печатной линии.';
    }
    if(levelNumber===4){
      if(this.rewind)return this.rewind.reason==='gate'?'Створка отпустила лист. Верните массу на тормоз и выберите другой момент.':'Ролик прижал лист. Вы возвращаетесь в последнее углубление.';
      if(topoLayout.rollers.some((r,i)=>r.y>drop.y&&r.y-drop.y<240&&this.rollerPhase(i)>4.1))return 'Щелчок, затем тень. Переждите прижим в углублении.';
      if(this.exitSecured)return 'Весь этот путь — лишь часть испорченной строки.';
      if(this.shutterLatched)return drop.ink>=requiredInk?'Тяжёлое тело тормозит лист. Выберите момент, затем уменьшайтесь.':'Тормоз отпущен. Пройдите два прижима до закрытия створки.';
      if(drop.y>2320)return drop.ink>=requiredInk?'Удерживайте тяжёлым телом створку, пока не защёлкнется.':'Створке нужна масса. Соберите чернила в углублениях.';
      return 'Лист движется. Идите от углубления к углублению после прохода ролика.';
    }
    if(this.balanceReady)return 'Ирис открывается справа от нижней чаши.';
    if(cupLoads[0]<topoLayout.cupRequired)return 'Оставьте часть запаса в верхней чаше. Обеим точкам нужен вес.';
    if(drop.y<1450)return 'Верхняя точка удерживается чернилами. Перенесите оставшийся вес вниз.';
    if(drop.ink>=topoLayout.bodyRequired&&Math.hypot(drop.x-plate.x,drop.y-plate.y)<100){
      if(Math.abs(cupLoads[0]-drop.ink)<=topoLayout.balanceTolerance)return 'Останьтесь в нижней чаше, пока заполняется ободок.';
      return cupLoads[0]>drop.ink?'Верхняя чаша тяжелее. Верните часть её запаса в тело.':'Нижняя чаша тяжелее. Часть вашего запаса нужна наверху.';
    }
    return drop.ink<topoLayout.bodyRequired?'Тела слишком мало для второй точки. Вернитесь и заберите часть запаса.':'Нажмите вторую чашу своим телом. Чернила в первой должны остаться.';
  }
  get goal(){
    if(levelNumber===3){
      if(this.links[1]&&this.links[2])return 'Оба нижних контакта проводят. Выход питается чернилами.';
      if(this.firstLatched)return this.links[0]?'Клемма удерживает проход. Запас всё ещё наверху.':'Единственный запас теперь должен питать две цепи.';
      if(drop.y>1050)return 'Первый проход всё ещё зависит от верхней перемычки.';
      return 'Линия разорвана. Запас чернил единственный.';
    }
    if(levelNumber===4){
      if(this.exitSecured)return 'Строка осталась позади.';
      if(this.shutterLatched)return drop.ink>=requiredInk?'Лист остановлен вашим весом.':'Тормоз отпущен. Створка скоро закроется.';
      return drop.y>2320?'Створку удерживает тяжёлый прижим.':'Пройдите испорченную строку между прижимами.';
    }
    if(this.balanceReady)return 'Равновесие зафиксировано. Идите к выходу.';
    if(cupLoads[0]<topoLayout.cupRequired)return 'Две чаши удерживают выход закрытым.';
    if(drop.y<1450)return 'Верхняя точка получила вес.';
    if(drop.ink<topoLayout.bodyRequired)return 'Нижняя точка не набрала необходимый вес.';
    if(Math.abs(cupLoads[0]-drop.ink)<=topoLayout.balanceTolerance)return 'Вес совпадает. Равновесие ещё не установилось.';
    return cupLoads[0]>drop.ink?'Верхняя точка тяжелее нижней.':'Нижняя точка тяжелее верхней.';
  }
}

function drawCampaignFloor(){
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  traceWire(ctx);ctx.strokeStyle='#979f8a';ctx.lineWidth=1.25;ctx.stroke();
  if(levelNumber===3){
    const latch=topoLayout.latch;
    ctx.beginPath();ctx.moveTo(latch.x,latch.y);ctx.bezierCurveTo(800,1560,1350,1300,1180,1050);ctx.strokeStyle=mechanisms.firstLatched?rust:'#a5afa0';ctx.lineWidth=1.2;ctx.stroke();
    oval(ctx,latch.x,latch.y,25,23,'#bccbb9');ctx.beginPath();ctx.arc(latch.x,latch.y,19,0,TAU);ctx.strokeStyle=mechanisms.firstLatched?rust:'#6a8877';ctx.lineWidth=1.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(latch.x-8,latch.y-9);ctx.lineTo(latch.x+8,latch.y-9);ctx.lineTo(latch.x+8,latch.y+9);ctx.lineTo(latch.x-8,latch.y+9);ctx.stroke();
    topoLayout.circuits.forEach((c,i)=>{
      const active=mechanisms.links[i],left=c.x-c.gap/2,right=c.x+c.gap/2;
      ctx.beginPath();ctx.moveTo(c.x-95,c.y-45);ctx.bezierCurveTo(c.x-65,c.y-45,c.x-65,c.y,left,c.y);
      ctx.moveTo(right,c.y);ctx.bezierCurveTo(c.x+70,c.y,c.x+65,c.y+48,c.x+100,c.y+48);
      ctx.strokeStyle='#8c9b8d';ctx.lineWidth=1.4;ctx.stroke();
      if(active){ctx.strokeStyle=rust;ctx.lineWidth=1.8;ctx.setLineDash([12,15]);ctx.lineDashOffset=-mechanisms.time*70;ctx.stroke();ctx.setLineDash([]);}
      oval(ctx,c.x-95,c.y-45,9,9,'#7e9685');oval(ctx,c.x-95,c.y-45,5,5,active?'#cc7651':'#dce4d7');
    });
    traceCurves(ctx,topoLayout.mechanismWire);ctx.strokeStyle=mechanisms.links[0]?rust:'#a5afa0';ctx.lineWidth=1.4;ctx.stroke();
    ctx.beginPath();ctx.moveTo(1030,1408);ctx.bezierCurveTo(1095,1505,1140,1310,1115,1345);ctx.strokeStyle=mechanisms.links[1]?rust:'#a5afa0';ctx.stroke();
  }else if(levelNumber===4){
    // The corrupted type travels in the same paper coordinate system.
    ctx.font='italic 118px Georgia,serif';ctx.textAlign='center';
    const symbols='∑?ж@∂§9&ф%';
    for(let row=0;row<7;row++)for(let col=-3;col<12;col++){
      const x=col*190+65*Math.sin(row*7+col),y=180+row*470;
      if(heightMap.sample(x,y)<40)continue;
      ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(row*11+col*3)*.16);
      ctx.globalAlpha=.09+(Math.sin(col*8+row*3)+1)*.055;ctx.fillStyle='#353c2e';ctx.fillText(symbols[(col+30+row*3)%symbols.length],0,0);ctx.restore();
    }
    const p=plate;oval(ctx,p.x,p.y,45,42,'#c7bea3');
    ctx.beginPath();ctx.ellipse(p.x,p.y,38,35,0,0,TAU);ctx.strokeStyle='#827653';ctx.lineWidth=1.3;ctx.stroke();
    const amount=mechanisms.shutterLatched?mechanisms.shutterTimer/7.5:mechanisms.shutterCharge/.85;
    ctx.beginPath();ctx.arc(p.x,p.y,42,-Math.PI/2,-Math.PI/2+TAU*amount);ctx.lineWidth=3;ctx.strokeStyle=rust;ctx.stroke();
    ctx.beginPath();ctx.moveTo(p.x-14,p.y);ctx.lineTo(p.x+14,p.y);ctx.moveTo(p.x,p.y-14);ctx.lineTo(p.x,p.y+14);ctx.strokeStyle='#8b7655';ctx.lineWidth=2;ctx.stroke();
  }else if(levelNumber===5){
    socketWire(ctx);ctx.strokeStyle=cupLoads[0]>=topoLayout.cupRequired?rust:'#ad9bad';ctx.lineWidth=1.25;ctx.stroke();
    topoLayout.cups.forEach((cup,i)=>{
      const ratio=i===0?clamp(cupLoads[0]/topoLayout.cupRequired,0,1):clamp(drop.ink/topoLayout.bodyRequired,0,1)*Number(Math.hypot(drop.x-cup.x,drop.y-cup.y)<44);
      oval(ctx,cup.x+2,cup.y+3,50,44,'#c5b7c0');oval(ctx,cup.x,cup.y,47,41,'#9e899e');oval(ctx,cup.x,cup.y,41,35,'#dfd5d5');
      for(const r of [42,50,56]){ctx.beginPath();ctx.ellipse(cup.x,cup.y,r,r*.87,0,0,TAU);ctx.strokeStyle='#8c738c';ctx.lineWidth=.75;ctx.stroke();}
      ctx.beginPath();ctx.ellipse(cup.x,cup.y,48,42,0,-Math.PI/2,-Math.PI/2+TAU*ratio);ctx.lineWidth=2.4;ctx.strokeStyle=ratio>=1?rust:'#ab795e';ctx.stroke();
      const imbalance=clamp((drop.ink-cupLoads[0])*3,-.9,.9);
      const even=Math.abs(drop.ink-cupLoads[0])<=topoLayout.balanceTolerance;
      ctx.beginPath();ctx.moveTo(cup.x-28,cup.y-60-imbalance*15);ctx.lineTo(cup.x+28,cup.y-60+imbalance*15);
      ctx.strokeStyle=even?rust:'#7a597d';ctx.lineWidth=1.7;ctx.stroke();
      ctx.beginPath();ctx.moveTo(cup.x,cup.y-67);ctx.lineTo(cup.x,cup.y-54);ctx.stroke();
      if(i===1){
        ctx.beginPath();ctx.ellipse(cup.x,cup.y,61,53,0,-Math.PI/2,-Math.PI/2+TAU*mechanisms.balanceCharge/.8);ctx.strokeStyle=rust;ctx.lineWidth=2;ctx.stroke();
      }
    });
    if(mechanisms.dotFlash>=0&&mechanisms.dotFlash<2.4){
      ctx.globalAlpha=Math.sin(Math.PI*mechanisms.dotFlash/2.4)*.12;
      for(const cup of topoLayout.cups)oval(ctx,cup.x,cup.y,66,60,'#302433');
    }
  }
  ctx.restore();
}
function drawCampaignDevices(){
  if(mechanisms?.layer==='under')return;
  if(levelNumber===3){
    for(const c of topoLayout.circuits)for(const sign of [-1,1]){
      const x=c.x+sign*c.gap/2;ctx.beginPath();ctx.arc(x,c.y,6,0,TAU);ctx.strokeStyle='#b06e4a';ctx.lineWidth=1.7;ctx.stroke();
    }
  }
  if(opening>0){
    ctx.save();ctx.globalAlpha=unlocked?1:opening;traceWire(ctx);ctx.strokeStyle=rust;ctx.lineWidth=1.8;ctx.lineCap='round';const p=exitWireProgress();ctx.setLineDash(p>=1?[]:[exitWireLength*p,exitWireLength+4]);ctx.stroke();ctx.restore();
  }
  if(levelNumber===16)mechanisms.drawExit();else drawPortal();
}
function drawRollers(){
  if(levelNumber!==4)return;
  topoLayout.rollers.forEach((roller,i)=>{
    const p=mechanisms.rollerPhase(i),warn=clamp((p-4.1)/1.15,0,1),down=p>=5.25&&p<6.05;
    ctx.save();ctx.translate(roller.x,roller.y);
    ctx.strokeStyle='#a99f80';ctx.lineWidth=.8;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(side*(roller.width/2+9),-55);ctx.lineTo(side*(roller.width/2+17),-55);ctx.lineTo(side*(roller.width/2+17),55);ctx.lineTo(side*(roller.width/2+9),55);ctx.stroke();}
    if(warn>0){
      const shade=ctx.createLinearGradient(0,-80,0,80);shade.addColorStop(0,'rgba(24,28,23,0)');shade.addColorStop(.4,'rgba(24,28,23,'+(.05+warn*.15)+')');shade.addColorStop(.7,'rgba(24,28,23,'+(.09+warn*.18)+')');shade.addColorStop(1,'rgba(24,28,23,0)');
      ctx.fillStyle=shade;ctx.fillRect(-2000,-80,4000,160);
    }
    if(down){
      const rubber=ctx.createLinearGradient(0,-35,0,35);rubber.addColorStop(0,'#696b56');rubber.addColorStop(.38,'#a3a38d');rubber.addColorStop(.75,'#666c58');rubber.addColorStop(1,'#3e493a');
      ctx.fillStyle=rubber;ctx.globalAlpha=.86;ctx.fillRect(-roller.width/2,-34,roller.width,68);
      ctx.strokeStyle='rgba(35,45,34,.24)';ctx.lineWidth=.65;for(let y=-28;y<32;y+=5){ctx.beginPath();ctx.moveTo(-roller.width/2,y);ctx.lineTo(roller.width/2,y);ctx.stroke();}
    }ctx.restore();
  });
}
