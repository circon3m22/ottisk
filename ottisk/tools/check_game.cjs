// Run the real game controller at its fixed step, with only the browser shell
// stubbed out. Rendering is checked separately in a clean local browser.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'../dist');
const selected=Number(process.argv[2])||0;
const browserMode=process.argv.includes('--browser'),browserCases=[];
function verify(code,context){if(browserMode)browserCases.push({level:context.OTTISK_LEVEL,code});else vm.runInContext(code,context);}
function load(level){
  const element=()=>({textContent:'',open:false,width:0,height:0,addEventListener(){},setAttribute(){},getContext(){return {};},focus(){},close(){this.open=false;},showModal(){this.open=true;}});
  const elements=new Map(),document={hidden:false,querySelector(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},createElement:element,addEventListener(){}};
  const context=vm.createContext({console,document,OTTISK_LEVEL:level,innerWidth:1440,innerHeight:900,devicePixelRatio:1,matchMedia:()=>({matches:false}),window:{addEventListener(){}},requestAnimationFrame(){},GameSound:class{silence(){}play(){}activate(){}rolling(){}}});
  const source=['levels.js','terrain.js','physics.js','mechanisms.js','tutorial.js','game.js'].map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n');
  vm.runInContext(source.replace('drawTerrain();reset();size();window.addEventListener(\'resize\',size);requestAnimationFrame(frame);','reset();size();'),context);
  return context;
}
const shared=`
  started=true;pointer=null;
  const check=(condition,message)=>{if(!condition){console.log({ink:drop.ink,spool:spool&&{x:spool.x,y:spool.y,position:spool.position,length:spool.rail.length},pools:inkPools.map(p=>({x:p.x,y:p.y,amount:p.amount})),gateOpening,links:mechanisms?.links,cupLoads});throw Error(message+' at '+drop.x.toFixed(1)+','+drop.y.toFixed(1)+' / '+tutorial.stage);}console.log('PASS: '+message);};
  const run=(n,x=drop.x,y=drop.y)=>{pointer=null;target={x,y};for(let i=0;i<n&&flowTime===null;i++)update();};
  const go=(x,y,n=2400)=>{pointer=null;target={x,y};for(let i=0;i<n&&flowTime===null&&Math.hypot(drop.x-x,drop.y-y)>6;i++)update();if(flowTime===null&&Math.hypot(drop.x-x,drop.y-y)>15)throw Error('Route '+x+','+y+' blocked at '+drop.x.toFixed(1)+','+drop.y.toFixed(1));};
  const push=object=>{for(let i=0;i<6000&&!object.seated;i++){const p=object.rail.point(object.position);target={x:object.x+p.tx*110,y:object.y+p.ty*110};update();}check(object.seated,'curved '+(object===weight?'heavy weight':'light spool')+' seats');};
  const curve=points=>heightMap.curveSegments(points,1,1,24,-1).filter((_,i)=>i%3===2).map(p=>[p.x+p.dx,p.y+p.dy]);
  const finish=()=>{check(flowTime!==null,'continuous exit starts');for(let i=0;i<200&&!solved;i++)advanceFlow(1/120);check(solved&&completion.open,'exit completes without hanging');};
`;
if(!selected||selected===1){console.log('LEVEL 1');
verify(shared+`
  check(inkPools.length===4,'ink is already scattered at reset');
  for(const p of [...heightMap.guides,[300,1530],[300,1640]])go(...p);
  run(500,600,1640);check(weight.position===0&&tutorial.stage==='ink','empty mouse gets mass lesson');
  go(230,1560);run(180);go(190,1840);run(180);go(1050,1830);run(180);
  check(drop.ink>=requiredInk,'existing sources supply enough mass');
  go(300,1800);go(300,1640);push(weight);run(400);
  check(gateOpening===1&&activationBlend>.95,'terrain seam and colour wave finish');
  go(980,1900);go(620,2000);run(650,596,2370);
  check(drop.y<passage.bottom&&tutorial.stage==='shed','full mouse stops at visible narrow banks');
  shedding=true;run(450,596,2360);shedding=false;go(596,2360);
  check(drop.y>passage.bottom,'small mouse crosses the entire seam');
  go(320,2420);run(100);check(unlocked,'second button opens exit');
  for(const p of heightMap.lowerGuides)go(...p);go(well.x,well.y);
  check(exitWireProgress()===1,'exit wire fills its full measured length');finish();
  reset();check(tutorial.stage==='move'&&gateOpening===0&&inkPools.length===4,'replay restores first room');
`,load(1));}
if(!selected||selected===2){console.log('LEVEL 2');
verify(shared+`
  check(drop.ink===.76&&!spool.seated&&!bypassOpened,'second room starts with recoverable ink');
  go(700,520);run(500,700,1050);check(drop.y<900,'full mouse cannot enter the eyelet');
  shedding=true;run(295,700,1050);shedding=false;
  go(700,1090);check(tutorial.entered&&inkPools.some(p=>p.amount>.1),'entry leaves the ink stock outside');
  go(530,1120);run(60);check(!bypassOpened,'button alone cannot open bypass');
  go(415,1220);push(spool);
  go(530,1120);run(220);check(bypassOpened&&gateOpening===1,'spool plus separate button latches bypass');
  go(700,1090);for(const p of [...heightMap.guides].reverse())go(...p);go(700,550);
  for(let n=0;n<5&&drop.ink<.7;n++){const pool=inkPools.find(p=>p.amount>.01);if(!pool)break;go(pool.x,pool.y);run(200);}
  check(drop.ink>=.65,'released ink can be recovered outside');
  run(500,700,1090);check(drop.y<900,'full mouse needs the wide return route');
  go(700,430);for(const p of heightMap.bypassGuides)go(...p);
  for(const p of curve(topoLayout.gate.points))go(...p);
  for(const p of [...heightMap.returnGuides].reverse())go(...p);
  go(470,1440);go(490,1450);push(weight);run(400);
  check(lowerOpening===0&&!unlocked,'heavy weight still needs the power contact rerouted');
  go(795,1375);
  for(let i=0;i<6000&&!spool.atStart;i++){const p=spool.rail.point(spool.position);target={x:spool.x-p.tx*110,y:spool.y-p.ty*110};update();}
  run(250);check(spool.atStart&&lowerOpening===1,'returning the same spool powers the lower loop');
  go(750,1790);for(const p of curve(topoLayout.lowerGate.points))go(...p);go(700,2380);
  go(450,2500);go(450,2920);go(700,2960);run(180);check(unlocked,'lower loop contact opens the iris after both weights');
  go(well.x,well.y);finish();
  reset();check(drop.ink===.76&&inkPools.length===0&&!spool.seated&&!bypassOpened&&lowerOpening===0&&!unlocked,'replay resets every second-room mechanism');
`,load(2));}

if(!selected||selected===3){console.log('LEVEL 3');
verify(shared+`
  const a={x:584,y:650},b={x:616,y:650};
  check(!inkConnection(a,b,[new InkDrop(600,674,0,.3)]),'visual proximity alone does not close a circuit');
  check(inkConnection(a,b,[new InkDrop(600,650,0,.3)]),'a continuous wet body joins both contacts');
  const deposit=(x,y,n=85)=>{go(x,y+75);go(x,y-25);shedding=true;run(n,x,y-25);run(30,x,y-135);shedding=false;go(x,y-135);run(300);};
  deposit(600,650);check(mechanisms.links[0]&&gateOpening===1,'first real expelled bridge opens its channel');
  go(710,650);for(const p of curve(topoLayout.gate.points))go(...p);
  go(910,1250);for(const p of curve(topoLayout.paths[0].points))go(...p);go(845,1450);
  check(mechanisms.firstLatched,'inside clamp holds the first passage mechanically');
  go(1100,1200);go(1180,1050);for(const p of curve(topoLayout.gate.points).reverse())go(...p);go(710,650);go(600,650);run(240);
  for(let i=0;i<4;i++){const pool=inkPools.find(p=>p.amount>.003);if(!pool)break;go(pool.x,pool.y);run(160);}
  check(drop.ink>.56&&!mechanisms.links[0]&&gateOpening===1,'limited ink is reclaimed while the clamp keeps the return open');
  go(710,650);for(const p of curve(topoLayout.gate.points))go(...p);deposit(930,1360);deposit(1210,1390);
  check(mechanisms.links[1]&&mechanisms.links[2],'both series breaks need actual fluid contact');
  go(1320,1250);go(1320,1490);go(1080,1590);
  for(const p of curve(topoLayout.lowerGate.points))go(...p);go(well.x,well.y);finish();
  reset();inkPools=[new InkDrop(600,650,0,.3)];drop=new Drop(600,650);target={x:600,y:650};run(200);
  check(!mechanisms.links[0]&&drop.ink>.29,'collecting a bridge really breaks its electrical contact');
`,load(3));}

if(!selected||selected===4){console.log('LEVEL 4');
verify(shared+`
  mechanisms.time=4.2;drop=new Drop(1100,730,.3);target={x:1100,y:730};update();
  check(mechanisms.warned.size>0&&!mechanisms.rewind,'roller gives a warning before contact');
  mechanisms.time=5.3;drop=new Drop(1100,800,.3);target={x:1100,y:800};update();
  check(mechanisms.rewind!==null,'active roller presses the mouse');
  for(let i=0;i<100;i++)update();
  check(!mechanisms.rewind&&Math.abs(drop.ink-.3)<1e-9&&Math.hypot(drop.x-spawn.x,drop.y-spawn.y)<10,'recovery preserves ink and returns to safe paper');
  reset();started=true;
  const safeGo=(x,y)=>{
    for(let i=0;i<topoLayout.rollers.length;i++){
      const r=topoLayout.rollers[i];if(drop.y<r.y-50&&y>r.y-95&&Math.abs(x-r.x)<r.width/2+100){
        for(let n=0;n<800&&mechanisms.rollerPhase(i)>2.8;n++)run(1);
      }
    }go(x,y);
  };
  for(const p of heightMap.guides)safeGo(...p);safeGo(1100,1020);go(1140,1070);run(180);
  for(const p of heightMap.lowerGuides)safeGo(...p);safeGo(400,1720);go(300,1730);run(180);
  for(const p of heightMap.returnGuides)safeGo(...p);safeGo(1050,2470);
  for(let n=0;n<800&&((mechanisms.time%6.4)<1.65||(mechanisms.time%6.4)>1.75);n++)run(1);
  go(1000,2460);run(220);
  check(mechanisms.shutterLatched&&gateOpening===1,'sufficient body mass holds and latches the shutter');
  const frozen=mechanisms.time;run(80);check(mechanisms.time===frozen,'a heavy body on the brake really stops the feed clock');
  shedding=true;run(230,1000,2630);shedding=false;
  for(const p of curve(topoLayout.gate.points))go(...p);
  go(700,3000);run(160);check(mechanisms.revealAge>0&&sheetOffset()<0,'moving paper opens the final scale reveal');
  go(well.x,well.y);finish();
  reset();mechanisms.checkpoint={x:1050,y:2470};drop=new Drop(850,2780,.08);target={x:850,y:2780};
  mechanisms.shutterLatched=true;mechanisms.shutterCharge=.85;mechanisms.shutterTimer=.001;gateOpening=1;update();
  check(mechanisms.rewind?.reason==='gate','missing the timed window releases the shutter and returns the body');
  for(let i=0;i<100;i++)update();
  check(!mechanisms.rewind&&Math.abs(drop.ink-.08)<1e-9,'expired shutter recovery preserves the remaining body ink');
`,load(4));}

if(!selected||selected===5){console.log('LEVEL 5');
verify(shared+`
  go(850,925);go(850,815);shedding=true;run(130,850,815);run(30,850,705);shedding=false;go(850,705);run(250);
  check(cupLoads[0]>=topoLayout.cupRequired&&drop.ink>=topoLayout.bodyRequired,'one stock can support the first cup and the remaining body');
  go(600,1010);for(const p of curve(topoLayout.gate.points))go(...p);go(850,1820);run(200);
  check(mechanisms.balanceReady&&unlocked,'separated first ink cup and second body cup hold the exit');
  go(well.x,well.y);finish();
  reset();inkPools=[new InkDrop(850,850,0,.6)];drop=new Drop(850,1820,.16);target={x:850,y:1820};run(100);
  check(!unlocked,'overfilling the first cup leaves too little body mass for the second');
  reset();inkPools=[new InkDrop(850,850,0,.28)];drop=new Drop(850,1820,.48);target={x:850,y:1820};run(150);
  check(!unlocked,'both thresholds alone are insufficient without equilibrium');
  inkPools=[new InkDrop(850,850,0,.6)];
  drop=new Drop(850,850,.16);target={x:850,y:850};run(80);
  check(drop.ink>.4,'a poor allocation can be reversed by collecting from the first cup');
`,load(5));}
if(browserMode){
  fs.writeFileSync(path.join(root,'browser-tests.js'),'window.OTTISK_TESTS='+JSON.stringify(browserCases)+';\n');
  fs.copyFileSync(path.join(__dirname,'browser-check.html'),path.join(root,'browser-check.html'));
  console.log('Prepared '+browserCases.length+' browser controller routes. Open browser-check.html on the local server.');
}
