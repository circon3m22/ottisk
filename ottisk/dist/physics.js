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

const {worldSize,spawn,railStart,socket,plate,well,passage}=topoLayout;
const rocks=[heightMap.collider];
const turnRadius=46, elbow=socket.x-railStart.x-turnRadius;
const arcLength=Math.PI*turnRadius/2;
const railSign=Math.sign(socket.y-railStart.y)||-1;
const railLength=elbow+arcLength+Math.abs(railStart.y-socket.y)-turnRadius;
const limits = {left:34,right:worldSize.width-40,top:38,bottom:worldSize.height-40};
const requiredInk=.52;
const barriers=[];
const colliders=()=>rocks.concat(barriers);
function createRail(start,finish){
  const bend=46,straight=finish.x-start.x-bend,arc=Math.PI*bend/2,sign=Math.sign(finish.y-start.y)||1;
  return {start,finish,length:straight+arc+Math.abs(finish.y-start.y)-bend,point(s){
    if(s<straight)return {x:start.x+s,y:start.y,tx:1,ty:0};
    if(s<straight+arc){const a=(s-straight)/bend;return {x:finish.x-bend+Math.sin(a)*bend,y:start.y+sign*bend-sign*Math.cos(a)*bend,tx:Math.cos(a),ty:sign*Math.sin(a)};}
    return {x:finish.x,y:start.y+sign*(bend+s-straight-arc),tx:0,ty:sign};
  }};
}
const mainRail=createRail(railStart,socket);
function railPoint(s){return mainRail.point(s);}

function expel(p,rock,clearance=0) {
  if(rock.terrain){rock.terrain.collide(p,clearance);return;}
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

// The round printing weight follows a tangent-continuous curved guide.
class Counterweight {
  constructor(options={}){
    this.rail=options.rail||mainRail;this.minimumInk=options.minimumInk??requiredInk;
    this.lockAtEnd=options.lockAtEnd!==false;
    this.position=0;this.speed=0;this.x=this.rail.start.x;this.y=this.rail.start.y;this.radius=options.radius||35;
    this.loadX=0;this.loadY=0;this.strain=0;this.locked=false;
  }
  guidePush(body,target){
    if(this.locked)return target;
    // Traction on a deliberate shove keeps small gait oscillations from
    // rolling the mouse off the curved rim. Tangential input releases it.
    const x=this.x-body.x,y=this.y-body.y;
    if(Math.hypot(x,y)>this.radius+body.bodyRadius+12)return target;
    const {tx,ty}=this.rail.point(this.position),nx=-ty,ny=tx;
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
    const tangent=this.rail.point(this.position);
    const pressure=this.loadX*tangent.tx+this.loadY*tangent.ty;
    this.strain+=(clamp(Math.abs(pressure)/7,0,1)-this.strain)*.08;
    if(this.locked||ink<this.minimumInk){this.speed=0;return;}
    const strength=.12+2.4*ink+(this.minimumInk===0?.85:0);
    const acceleration=Math.sign(pressure)*Math.max(0,Math.abs(pressure)-.22)*230*strength;
    const maxSpeed=9+141*ink+(this.minimumInk===0?50:0);
    this.speed=clamp((this.speed+acceleration*stepTime)*.95,-maxSpeed,maxSpeed);
    if(Math.abs(this.speed)<.6 && Math.abs(acceleration)<4)this.speed=0;
    let next=clamp(this.position+this.speed*stepTime,0,this.rail.length);
    if(next===0 || next===this.rail.length)this.speed=0;
    if(next>=this.rail.length-5&&this.speed>=0){next=this.rail.length;this.speed=0;if(this.lockAtEnd)this.locked=true;}
    this.position=next;
    const point=this.rail.point(next);this.x=point.x;this.y=point.y;
  }
  get seated(){return this.locked||(!this.lockAtEnd&&this.position>=this.rail.length-4&&Math.abs(this.speed)<5);}
  get atStart(){return this.position<4&&Math.abs(this.speed)<5;}
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
      if(rock.terrain){if(rock.terrain.lineBlocked(this.x,this.y,other.x,other.y))return;continue;}
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
    this.collectDelay=Math.max(this.collectDelay||0,other.collectDelay||0);
    this.needsSeparation=Boolean(this.needsSeparation||other.needsSeparation);
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
    if(this.needsSeparation&&d>mouse.bodyRadius+r+20)this.needsSeparation=false;
    const take=collecting && touching && !this.needsSeparation && this.age>=(this.collectDelay||0) && mouse.ink<1 && this.amount>0;
    if(take){
      const amount=Math.min(this.amount,1-mouse.ink,.5*dt);
      this.amount-=amount;mouse.ink+=amount;mouse.absorbing=1;
      this.vx+=dx*35*dt;this.vy+=dy*35*dt;
    }else if(touching&&d>.01&&!this.inBasin){
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
    const weights=Array.isArray(weight)?weight:weight?[weight]:[];
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
        for(const object of weights)object.contact(p,p.width);
        p.x=clamp(p.x,limits.left+p.width,limits.right-p.width);
        p.y=clamp(p.y,limits.top+p.width,limits.bottom-p.width);
        heading=Math.atan2(p.y-parent.y,p.x-parent.x);
      }
    }
  }
}
class Drop {
  constructor(x,y,initialInk=0) {
    this.x=x;this.y=y;this.vx=0;this.vy=0;this.heading=.12;
    this.stride=0;
    this.ink=initialInk;
    this.bodyRadius=radius*Math.sqrt(1+1.3*initialInk);
    this.absorbing=0;
    this.shedding=false;
    this.effort=0;
    this.trailingHeading=this.heading;
    this.nodes=Array.from({length:28},(_,i)=>{
      const a=i*TAU/28,dx=Math.cos(a),dy=Math.sin(a);
      return {dx,dy,x:x+dx*this.bodyRadius,y:y+dy*this.bodyRadius,vx:0,vy:0};
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
    const weights=Array.isArray(weight)?weight:weight?[weight]:[];
    const dt=stepTime, oldX=this.x,oldY=this.y, ns=this.nodes;
    this.bodyRadius+=(radius*Math.sqrt(1+1.3*this.ink)-this.bodyRadius)*.045;
    const size=this.bodyRadius/radius;
    const desiredArea=this.restArea*size*size;
    for(const object of weights)target=object.guidePush(this,target);
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
    const near=obstacles.filter(r=>oldX>r.left-90&&oldX<r.right+90&&oldY>r.top-90&&oldY<r.bottom+90);
    this.impact=null;
    for(const object of weights){object.loadX=0;object.loadY=0;}
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
        for(const object of weights)object.contact(p);
        p.x=clamp(p.x,limits.left,limits.right);p.y=clamp(p.y,limits.top,limits.bottom);
        if(pass===0){
          const nx=p.x-incomingX,ny=p.y-incomingY,depth=Math.hypot(nx,ny);
          const closing=depth>.015?-(this.vx*nx+this.vy*ny)/depth:0;
          if(closing>65 && closing>(this.impact?.speed||0)){
            this.impact={x:p.x,y:p.y,speed:closing,nx:nx/depth,ny:ny/depth};
          }
        }
      }
      // The liquid can flatten, but its core still needs room between the
      // visible banks. A shared terrain contact replaces the hidden size wall.
      this.center();
      for(const object of weights){
        const dx=this.x-object.x,dy=this.y-object.y,d=Math.hypot(dx,dy),minimum=object.radius+this.bodyRadius*.62;
        if(d<minimum&&d>.001){
          const sx=dx/d*(minimum-d),sy=dy/d*(minimum-d);
          for(const p of ns){p.x+=sx;p.y+=sy;}
          object.loadX-=sx*.65;object.loadY-=sy*.65;this.center();
        }
      }
      const clearance=this.bodyRadius*.7;
      const allowed=Math.max(-.1,heightMap.coreContact(oldX,oldY,clearance).value);
      if(heightMap.coreContact(this.x,this.y,clearance).value>allowed){
        let cx=this.x,cy=this.y;
        // Resolve only the bank normal. The tangent remains free, so steering
        // into a curved wall slides along it rather than pinning the body.
        for(let i=0;i<4;i++){
          const contact=heightMap.coreContact(cx,cy,clearance),excess=contact.value-allowed;if(excess<=.00001)break;
          const gx=(heightMap.sample(contact.x+3,contact.y)-heightMap.sample(contact.x-3,contact.y))/6;
          const gy=(heightMap.sample(contact.x,contact.y+3)-heightMap.sample(contact.x,contact.y-3))/6;
          const g2=gx*gx+gy*gy;if(g2<.004)break;
          const correction=Math.min(8,(excess+.006)/Math.sqrt(g2));
          cx-=gx/Math.sqrt(g2)*correction;cy-=gy/Math.sqrt(g2)*correction;
        }
        let low=0,high=1;
        for(let i=0;i<9;i++){
          const t=(low+high)*.5;
          if(heightMap.coreContact(oldX+(cx-oldX)*t,oldY+(cy-oldY)*t,clearance).value<=allowed+.000001)low=t;else high=t;
        }
        const shiftX=oldX+(cx-oldX)*low-this.x,shiftY=oldY+(cy-oldY)*low-this.y;
        for(const p of ns){p.x+=shiftX;p.y+=shiftY;}
      }
    }
    this.center();this.vx=(this.x-oldX)/dt;this.vy=(this.y-oldY)/dt;
    for(const p of ns){p.vx=clamp((p.x-p.oldX)/dt,-800,800);p.vy=clamp((p.y-p.oldY)/dt,-800,800);}
    for(const object of weights)object.advance(this.ink);
    this.tail.advance(this,weight);
  }
}
