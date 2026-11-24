'use strict';
// The membrane is integrated at a fixed rate. All coordinates are in floor units.
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const radius = 32;
const stepTime = 1 / 120;

function roundedLoop(corners) {
  let vertices = corners;
  for (let pass = 0; pass < 3; pass++) {
    const next = [];
    vertices.forEach(([x,y], i) => {
      const [u,v] = vertices[(i+1)%vertices.length];
      next.push([.75*x+.25*u,.75*y+.25*v],[.25*x+.75*u,.25*y+.75*v]);
    });
    vertices = next;
  }
  const xs = vertices.map(p=>p[0]), ys = vertices.map(p=>p[1]);
  return {vertices, left:Math.min(...xs), right:Math.max(...xs), top:Math.min(...ys), bottom:Math.max(...ys)};
}

const worldSize={width:1260,height:3300};
const rocks = [
  [[-120,526],[174,535],[225,594],[220,1260],[180,1370],[-120,1375]],
  [[995,592],[1030,531],[1380,520],[1380,1375],[1040,1370],[997,1280]],
  [[186,672],[602,667],[694,706],[690,752],[629,782],[190,778]],
  [[480,928],[541,900],[1050,915],[1065,1024],[550,1027],[481,994]],
  [[192,1156],[555,1145],[652,1181],[650,1224],[592,1254],[193,1247]],
  [[651,1430],[1015,1390],[1117,1464],[1060,1557],[689,1550],[650,1512]],
  [[43,1496],[148,1460],[197,1507],[169,1606],[53,1634]],
  [[1013,1795],[1150,1751],[1235,1839],[1170,1940],[1061,1912]],
  [[-100,2110],[143,2096],[329,2112],[513,2097],[570,2100],[570,2214],[511,2228],[303,2213],[98,2235],[-100,2232]],
  [[622,2100],[679,2090],[821,2105],[1062,2084],[1380,2104],[1380,2238],[1100,2218],[902,2233],[688,2222],[622,2218]],
  [[42,2382],[153,2312],[230,2378],[205,2518],[73,2571],[35,2490]],
  [[653,2348],[1021,2303],[1140,2426],[1066,2538],[758,2521],[621,2460]],
  [[-100,2700],[361,2684],[596,2711],[613,2764],[556,2812],[-100,2801]],
  [[788,2908],[845,2872],[1380,2891],[1380,3004],[841,2994],[779,2957]]
].map(roundedLoop);
const spawn={x:590,y:190}, railStart={x:450,y:1640}, socket={x:850,y:1890};
const turnRadius=46, elbow=socket.x-railStart.x-turnRadius;
const arcLength=Math.PI*turnRadius/2;
const railSign=Math.sign(socket.y-railStart.y)||-1;
const railLength=elbow+arcLength+Math.abs(railStart.y-socket.y)-turnRadius;
const plate={x:320,y:2420}, well={x:820,y:3120};
const limits = {left:34,right:1220,top:38,bottom:3260};
const requiredInk=.52;
const passage={x:596,y:2160,left:570,right:622,top:2100,bottom:2232,maxRadius:35.4};
const gateBarrier=roundedLoop([[567,2100],[625,2100],[625,2116],[567,2116]]);
const sizeBarrier=roundedLoop([[567,2110],[625,2110],[625,2124],[567,2124]]);
const barriers=[];
const colliders=()=>rocks.concat(barriers);
function railPoint(s){
  if(s<elbow)return {x:railStart.x+s,y:railStart.y,tx:1,ty:0};
  if(s<elbow+arcLength){
    const a=(s-elbow)/turnRadius;
    return {x:socket.x-turnRadius+Math.sin(a)*turnRadius,y:railStart.y+railSign*turnRadius-railSign*Math.cos(a)*turnRadius,tx:Math.cos(a),ty:railSign*Math.sin(a)};
  }
  return {x:socket.x,y:railStart.y+railSign*(turnRadius+s-elbow-arcLength),tx:0,ty:railSign};
}

function expel(p,rock,clearance=0) {
  if(p.x<rock.left-clearance || p.x>rock.right+clearance ||
     p.y<rock.top-clearance || p.y>rock.bottom+clearance) return;
  const vs=rock.vertices;
  let inside=false, nearest=Infinity, hitX=0, hitY=0;
  for(let i=0,j=vs.length-1;i<vs.length;j=i++){
    const [x,y]=vs[j], [u,v]=vs[i], dx=u-x,dy=v-y;
    if((y>p.y)!==(v>p.y) && p.x<(u-x)*(p.y-y)/(v-y)+x) inside=!inside;
    const t=clamp(((p.x-x)*dx+(p.y-y)*dy)/(dx*dx+dy*dy),0,1);
    const hx=x+t*dx,hy=y+t*dy,d=(hx-p.x)**2+(hy-p.y)**2;
    if(d<nearest){nearest=d;hitX=hx;hitY=hy;}
  }
  if(inside || nearest<clearance*clearance){
    const distance=Math.sqrt(nearest);
    const offset=distance>1e-8 ? (inside?-clearance:clearance)/distance : 0;
    p.x=hitX+(p.x-hitX)*offset;
    p.y=hitY+(p.y-hitY)*offset;
  }
}

// A heavy roller runs in a right-angle groove. At the elbow the player
// must apply pressure along the new axis before it will move again.
class Counterweight {
  constructor(){
    this.position=0;this.speed=0;this.x=railStart.x;this.y=railStart.y;this.radius=35;
    this.loadX=0;this.loadY=0;this.strain=0;this.locked=false;
  }
  guidePush(body,target){
    // Traction on a deliberate shove keeps small gait oscillations from
    // rolling the mouse off the curved rim. Tangential input releases it.
    const x=this.x-body.x,y=this.y-body.y;
    if(Math.hypot(x,y)>this.radius+body.bodyRadius+12)return target;
    const {tx,ty}=railPoint(this.position),nx=-ty,ny=tx;
    const along=x*tx+y*ty,across=x*nx+y*ny;
    const alongAim=(target.x-body.x)*tx+(target.y-body.y)*ty;
    const sideAim=(target.x-body.x)*nx+(target.y-body.y)*ny;
    if(alongAim*along<=0 || Math.abs(across)>24 || Math.abs(sideAim)>.5*Math.abs(alongAim))return target;
    const push=clamp(alongAim,-68,68);
    return {x:body.x+push*tx+4*across*nx,y:body.y+push*ty+4*across*ny};
  }
  contact(p,margin=0){
    const dx=p.x-this.x,dy=p.y-this.y,d=Math.hypot(dx,dy),depth=this.radius+margin-d;
    if(depth<=0||d<1e-8)return;
    const shiftX=dx/d*depth,shiftY=dy/d*depth;
    p.x+=shiftX;p.y+=shiftY;
    if(margin===0){this.loadX-=shiftX;this.loadY-=shiftY;}
  }
  advance(ink=0){
    const tangent=railPoint(this.position);
    const pressure=this.loadX*tangent.tx+this.loadY*tangent.ty;
    this.strain+=(clamp(Math.abs(pressure)/7,0,1)-this.strain)*.08;
    if(this.locked||ink<requiredInk){this.speed=0;return;}
    const strength=.12+2.4*ink;
    const acceleration=Math.sign(pressure)*Math.max(0,Math.abs(pressure)-.22)*230*strength;
    const maxSpeed=9+141*ink;
    this.speed=clamp((this.speed+acceleration*stepTime)*.95,-maxSpeed,maxSpeed);
    if(Math.abs(this.speed)<.6 && Math.abs(acceleration)<4)this.speed=0;
    let next=clamp(this.position+this.speed*stepTime,0,railLength);
    if(next===0 || next===railLength)this.speed=0;
    if(next>=railLength-5){next=railLength;this.speed=0;this.locked=true;}
    this.position=next;
    const point=railPoint(next);this.x=point.x;this.y=point.y;
  }
  get seated(){return this.locked;}
}

class InkDrop {
  constructor(x,y,phase,amount=.38){
    this.x=x;this.y=y;this.vx=0;this.vy=0;this.amount=amount;this.phase=phase;this.age=0;
    this.lobes=[{x:0,y:0,amount}];
    this.rounding=.84;
    this.nodes=Array.from({length:20},(_,i)=>{
      const angle=i*TAU/20;
      const r=Math.sqrt(amount)*25;
      return {dx:Math.cos(angle),dy:Math.sin(angle),x:x+Math.cos(angle)*r,
        y:y+Math.sin(angle)*r,vx:0,vy:0};
    });
  }
  cohereWith(other){
    if(this.amount<=0||other.amount<=0)return;
    const dx=other.x-this.x,dy=other.y-this.y,distance=Math.hypot(dx,dy);
    const contact=(Math.sqrt(this.amount)+Math.sqrt(other.amount))*25*.9;
    const range=contact+50;
    if(distance>range)return;
    // Capillary motion acts across exposed paper, stopping at a stone edge.
    for(const rock of colliders()){
      if(Math.max(this.x,other.x)<rock.left||Math.min(this.x,other.x)>rock.right||
         Math.max(this.y,other.y)<rock.top||Math.min(this.y,other.y)>rock.bottom)continue;
      const vertices=rock.vertices;
      for(let i=0;i<vertices.length;i++){
        const a=vertices[i],b=vertices[(i+1)%vertices.length],ex=b[0]-a[0],ey=b[1]-a[1];
        const cross=dx*ey-dy*ex;
        if(Math.abs(cross)<1e-8)continue;
        const ax=a[0]-this.x,ay=a[1]-this.y;
        const t=(ax*ey-ay*ex)/cross,u=(ax*dy-ay*dx)/cross;
        if(t>0&&t<1&&u>=0&&u<=1)return;
      }
    }
    if(distance<=contact){this.absorbDrop(other);return;}
    const falloff=1-(distance-contact)/(range-contact);
    const impulse=240*falloff*stepTime/distance;
    const share=other.amount/(this.amount+other.amount);
    this.vx+=dx*impulse*share;this.vy+=dy*impulse*share;
    other.vx-=dx*impulse*(1-share);other.vy-=dy*impulse*(1-share);
  }
  absorbDrop(other){
    const sum=this.amount+other.amount,share=other.amount/sum;
    const x=this.x+(other.x-this.x)*share,y=this.y+(other.y-this.y)*share;
    // Keep the incoming footprints while surface tension gathers them
    // into a rounder pool over the next few moments.
    const scale=Math.sqrt(this.amount/this.lobes.reduce((n,p)=>n+p.amount,0));
    const otherScale=Math.sqrt(other.amount/other.lobes.reduce((n,p)=>n+p.amount,0));
    this.lobes=this.lobes.map(p=>({x:this.x-x+p.x*scale,y:this.y-y+p.y*scale,amount:p.amount*scale*scale}))
      .concat(other.lobes.map(p=>({x:other.x-x+p.x*otherScale,y:other.y-y+p.y*otherScale,amount:p.amount*otherScale*otherScale})));
    this.vx+=(other.vx-this.vx)*share;this.vy+=(other.vy-this.vy)*share;
    this.x=x;this.y=y;this.amount=sum;
    this.rounding=.45;
    this.age=Math.min(this.age,other.age);other.amount=0;
  }
  radialSize(dx,dy,scale){
    let reach=Math.sqrt(this.amount)*10;
    for(const lobe of this.lobes){
      const x=lobe.x*scale,y=lobe.y*scale,r=Math.sqrt(lobe.amount)*25*scale;
      const along=x*dx+y*dy,across=x*dy-y*dx;
      if(Math.abs(across)<r)reach=Math.max(reach,along+Math.sqrt(r*r-across*across));
    }
    return Math.sqrt(this.amount)*25*this.rounding+reach*(1-this.rounding);
  }
  advance(mouse,collecting){
    const dt=stepTime,r=Math.sqrt(this.amount)*25;
    this.rounding+=(.84-this.rounding)*(1-Math.exp(-3.8*dt));
    const dx=mouse.x-this.x,dy=mouse.y-this.y,d=Math.hypot(dx,dy);
    const touching=d<mouse.bodyRadius+r+9;
    const take=collecting && touching && mouse.ink<1 && this.amount>0;
    if(take){
      const amount=Math.min(this.amount,1-mouse.ink,.5*dt);
      this.amount-=amount;mouse.ink+=amount;mouse.absorbing=1;
      this.vx+=dx*35*dt;this.vy+=dy*35*dt;
    }else if(touching&&d>.01){
      const pressure=Math.max(0,mouse.bodyRadius+r-d);
      this.vx-=dx/d*pressure*18*dt;this.vy-=dy/d*pressure*18*dt;
    }
    this.vx*=.966;this.vy*=.966;this.x+=this.vx*dt;this.y+=this.vy*dt;
    const center={x:this.x,y:this.y};
    for(const rock of colliders())expel(center,rock,r);
    this.x=clamp(center.x,limits.left+r,limits.right-r);
    this.y=clamp(center.y,limits.top+r,limits.bottom-r);
    const speed=Math.hypot(this.vx,this.vy),angle=Math.atan2(this.vy,this.vx);
    const cx=Math.cos(angle),sy=Math.sin(angle),stretch=1+Math.min(.7,speed/240);
    const scale=Math.sqrt(this.amount/this.lobes.reduce((n,p)=>n+p.amount,0));
    const radii=this.nodes.map(p=>this.radialSize(p.dx,p.dy,scale));
    for(let i=0;i<this.nodes.length;i++){
      const p=this.nodes[i],n=this.nodes.length;
      const restRadius=(radii[(i+n-1)%n]+radii[i]*4+radii[(i+1)%n])/6;
      const along=p.dx*cx+p.dy*sy,side=-p.dx*sy+p.dy*cx;
      const wave=1+.07*Math.sin(this.age*12+this.phase)*Math.exp(-this.age*1.3)*(p.dx*p.dx-p.dy*p.dy);
      const x=this.x+restRadius*wave*(along*stretch*cx-side/stretch*sy);
      const y=this.y+restRadius*wave*(along*stretch*sy+side/stretch*cx);
      p.vx+=(360*(x-p.x)-17*p.vx)*dt;
      p.vy+=(360*(y-p.y)-17*p.vy)*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
      for(const rock of colliders())expel(p,rock);
      p.x=clamp(p.x,limits.left,limits.right);p.y=clamp(p.y,limits.top,limits.bottom);
    }
    this.age+=dt;
    return take;
  }
}

class Tail {
  constructor(body){
    this.spacing=5;
    this.points=[];
    let {x,y,angle}=this.attachment(body);
    for(let i=0;i<=14;i++){
      this.points.push({x,y,lastX:x,lastY:y,width:.65+2.15*(1-i/14)});
      angle+=.025;
      x+=this.spacing*Math.cos(angle);y+=this.spacing*Math.sin(angle);
    }
  }
  attachment(body){
    // Interpolate along the actual compressed membrane as the mouse turns.
    const angle=body.trailingHeading+Math.PI, nodes=body.nodes;
    const index=((angle/TAU%1+1)%1)*nodes.length;
    const i=Math.floor(index), f=index-i, a=nodes[i], b=nodes[(i+1)%nodes.length];
    const hipX=a.x+(b.x-a.x)*f,hipY=a.y+(b.y-a.y)*f;
    return {x:body.x+.83*(hipX-body.x),y:body.y+.83*(hipY-body.y),angle};
  }
  advance(body,weight){
    const points=this.points, base=this.attachment(body);
    const hipTravel=Math.hypot(base.x-points[0].x,base.y-points[0].y);
    const sliding=clamp(hipTravel/this.spacing,0,1);
    points[0].x=base.x;points[0].y=base.y;
    for(let i=1;i<points.length;i++){
      const p=points[i],dx=p.x-p.lastX,dy=p.y-p.lastY;
      // The raised base carries momentum. Floor friction arrests the free tip
      // where it lands until tension in the upstream links pulls it along.
      const contact=clamp((i-2)/6,0,1);
      const retention=(1-.08*contact)*Math.max(0,1-(.006+.085*contact)/Math.max(.001,Math.hypot(dx,dy)));
      p.lastX=p.x;p.lastY=p.y;p.x+=dx*retention;p.y+=dy*retention;
    }
    const reach=(points.length+2)*this.spacing;
    const nearby=colliders().filter(r=>base.x>r.left-reach && base.x<r.right+reach &&
      base.y>r.top-reach && base.y<r.bottom+reach);
    const skin=body.nodes.map(p=>[p.x,p.y]);
    const xs=skin.map(p=>p[0]),ys=skin.map(p=>p[1]);
    const shell={vertices:skin,left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys)};
    for(let pass=0;pass<6;pass++){
      let heading=base.angle;
      for(let i=1;i<points.length;i++){
        const parent=points[i-1],p=points[i];
        const dx=p.x-parent.x,dy=p.y-parent.y,angle=Math.atan2(dy,dx);
        const fraction=i/(points.length-1);
        const error=heading-angle;
        const turn=Math.atan2(Math.sin(error),Math.cos(error));
        // Only the muscular base holds an orientation. Distal joints retain
        // their lay on the floor, with a bend limit to prevent sharp folds.
        const bendLimit=.12+.47*fraction;
        const stiffness=i<=2?.54*(1-fraction)**5:.54*(1-fraction)**5*sliding;
        const residual=clamp(turn*(1-stiffness),-bendLimit,bendLimit);
        const next=heading-residual;
        const fixX=this.spacing*Math.cos(next)-dx,fixY=this.spacing*Math.sin(next)-dy;
        const share=i===1?0:.19;
        parent.x-=fixX*share;parent.y-=fixY*share;
        p.x+=fixX*(1-share);p.y+=fixY*(1-share);
        if(i>1)expel(p,shell,p.width*.5);
        for(const rock of nearby)expel(p,rock,p.width);
        if(weight)weight.contact(p,p.width);
        p.x=clamp(p.x,limits.left+p.width,limits.right-p.width);
        p.y=clamp(p.y,limits.top+p.width,limits.bottom-p.width);
        heading=Math.atan2(p.y-parent.y,p.x-parent.x);
      }
    }
  }
}
class Drop {
  constructor(x,y) {
    this.x=x;this.y=y;this.vx=0;this.vy=0;this.heading=.12;
    this.stride=0;
    this.ink=0;
    this.bodyRadius=radius;
    this.absorbing=0;
    this.shedding=false;
    this.effort=0;
    this.trailingHeading=this.heading;
    this.nodes=Array.from({length:28},(_,i)=>{
      const a=i*TAU/28,dx=Math.cos(a),dy=Math.sin(a);
      return {dx,dy,x:x+dx*radius,y:y+dy*radius,vx:0,vy:0};
    });
    this.restArea=28*Math.sin(TAU/28)*radius*radius/2;
    this.tail=new Tail(this);
  }
  center() {
    this.x=0;this.y=0;
    for(const p of this.nodes){this.x+=p.x;this.y+=p.y;}
    this.x/=this.nodes.length;this.y/=this.nodes.length;
  }
  advance(target,weight) {
    const dt=stepTime, oldX=this.x,oldY=this.y, ns=this.nodes;
    this.bodyRadius+=(radius*Math.sqrt(1+1.3*this.ink)-this.bodyRadius)*.045;
    const size=this.bodyRadius/radius;
    const desiredArea=this.restArea*size*size;
    if(weight)target=weight.guidePush(this,target);
    const dx=target.x-this.x,dy=target.y-this.y,dist=Math.hypot(dx,dy);
    const speed=Math.hypot(this.vx,this.vy);
    // Advance the gait by ground travelled. A blocked or resting body settles.
    const run=clamp((speed-4)/165,0,1)*clamp(dist/18,0,1);
    this.effort+=(run-this.effort)*.08;
    this.stride=(this.stride+TAU*speed*dt/(64+.28*speed))%(2*TAU);
    const push=Math.sin(this.stride);
    const maxSpeed=410/(1+1.4*this.ink);
    const drive=Math.min(5.2,maxSpeed/Math.max(1,dist))*(1+.26*this.effort*push);
    const response=8-2.8*this.ink;
    const ax=(dx*drive-this.vx)*response,ay=(dy*drive-this.vy)*response;
    if(speed>10){
      const diff=Math.atan2(this.vy,this.vx)-this.heading;
      this.heading+=Math.atan2(Math.sin(diff),Math.cos(diff))*.084;
    }
    const cx=Math.cos(this.heading),sy=Math.sin(this.heading);
    const turn=this.heading-this.trailingHeading;
    this.trailingHeading+=Math.atan2(Math.sin(turn),Math.cos(turn))*.055;
    const effort=this.effort;
    const bend=-.56*Math.sin(turn)*effort;
    const sway=Math.sin(this.stride*.5)*.21*effort;
    const stretch=1+.14*Math.min(1,speed/390)**1.5+.085*push*effort
      +this.absorbing*.045*Math.sin(this.stride+this.ink*25)
      +(this.shedding?.04*Math.sin(this.ink*65):0);
    // The front reaches first. A compression wave crosses the flanks, then
    // the rump gathers under the body. Alternate pushes favour opposite sides.
    let meanX=0,meanY=0;
    for(const p of ns){
      const along=p.dx*cx+p.dy*sy,across=-p.dx*sy+p.dy*cx;
      const rear=(1-along)*.5;
      const wave=Math.sin(this.stride-2.8*rear);
      const longitudinal=along*stretch+.085*effort*wave;
      const lateral=across*(1-.09*wave*effort)/stretch
        +(bend+sway)*rear*rear-.42*sway*along;
      p.restX=this.bodyRadius*(longitudinal*cx-lateral*sy);
      p.restY=this.bodyRadius*(longitudinal*sy+lateral*cx);
      meanX+=p.restX;meanY+=p.restY;
    }
    // Internal motion must not propel the centre away from the cursor.
    meanX/=ns.length;meanY/=ns.length;
    for(const p of ns){
      p.oldX=p.x;p.oldY=p.y;
      p.vx+=(ax+340*(this.x+p.restX-meanX-p.x)-16*(p.vx-this.vx))*dt;
      p.vy+=(ay+340*(this.y+p.restY-meanY-p.y)-16*(p.vy-this.vy))*dt;
      p.x+=p.vx*dt;p.y+=p.vy*dt;
    }
    const obstacles=colliders();
    if(this.bodyRadius>passage.maxRadius&&oldY<passage.top+24)obstacles.push(sizeBarrier);
    const near=obstacles.filter(r=>oldX>r.left-90&&oldX<r.right+90&&oldY>r.top-90&&oldY<r.bottom+90);
    this.impact=null;
    if(weight){weight.loadX=0;weight.loadY=0;}
    for(let pass=0;pass<3;pass++){
      this.center();
      let area=0,denom=0;
      ns.forEach((p,i)=>{
        const q=ns[(i+1)%ns.length],prev=ns[(i+ns.length-1)%ns.length];
        area+=((p.x-this.x)*(q.y-this.y)-(p.y-this.y)*(q.x-this.x))/2;
        p.gx=(q.y-prev.y)/2;p.gy=(prev.x-q.x)/2;denom+=p.gx*p.gx+p.gy*p.gy;
      });
      const pressure=clamp((desiredArea-area)/Math.max(1,denom),-.32,.32)*.46;
      ns.forEach((p,i)=>{
        p.x+=pressure*p.gx;p.y+=pressure*p.gy;
        const q=ns[(i+1)%ns.length],ex=q.x-p.x,ey=q.y-p.y,len=Math.hypot(ex,ey)||1;
        const correction=(len-clamp(len,3.4*size,11.8*size))/len*.42;
        p.x+=ex*correction;p.y+=ey*correction;q.x-=ex*correction;q.y-=ey*correction;
      });
      for(const p of ns){
        const incomingX=p.x,incomingY=p.y;
        for(const r of near)expel(p,r);
        if(weight)weight.contact(p);
        p.x=clamp(p.x,limits.left,limits.right);p.y=clamp(p.y,limits.top,limits.bottom);
        if(pass===0){
          const nx=p.x-incomingX,ny=p.y-incomingY,depth=Math.hypot(nx,ny);
          const closing=depth>.015?-(this.vx*nx+this.vy*ny)/depth:0;
          if(closing>65 && closing>(this.impact?.speed||0)){
            this.impact={x:p.x,y:p.y,speed:closing,nx:nx/depth,ny:ny/depth};
          }
        }
      }
    }
    this.center();this.vx=(this.x-oldX)/dt;this.vy=(this.y-oldY)/dt;
    for(const p of ns){p.vx=clamp((p.x-p.oldX)/dt,-800,800);p.vy=clamp((p.y-p.oldY)/dt,-800,800);}
    if(weight)weight.advance(this.ink);
    this.tail.advance(this,weight);
  }
}
