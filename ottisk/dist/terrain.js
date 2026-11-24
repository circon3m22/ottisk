'use strict';

// One scalar field is shared by the contour engraving and every collision.
// Negative heights are walkable valleys; positive heights are green ridges.
class ContourField {
  constructor(){
    this.step=6;this.left=-850;this.top=-850;
    this.nx=Math.ceil((topoLayout.worldSize.width+1700)/this.step)+1;this.ny=Math.ceil((topoLayout.worldSize.height+1700)/this.step)+1;
    this.width=(this.nx-1)*this.step;this.height=(this.ny-1)*this.step;
    this.opening=0;this.secondaryOpening=0;this.segments=[];this.paths=[];this.guides=[];this.lowerGuides=[];this.bypassGuides=[];this.returnGuides=[];this.buckets=new Map();this.bucketSize=160;
    this.coreDirections=Array.from({length:16},(_,i)=>[Math.cos(i*Math.PI/8),Math.sin(i*Math.PI/8)]);
    this.gateBounds=topoLayout.gate.bounds;
    for(const p of topoLayout.paths)this.addPath(p.points,p.r0,p.r1,p.guide);
    const gate=topoLayout.gate;
    this.gatePath=this.curveSegments(gate.points,gate.radius,gate.radius,32,-1);
    this.lowerGatePath=topoLayout.lowerGate?this.curveSegments(topoLayout.lowerGate.points,topoLayout.lowerGate.radius,topoLayout.lowerGate.radius,32,-1):[];
    this.rooms=topoLayout.rooms;
    this.indexSegments();this.closed=new Float32Array(this.nx*this.ny);this.delta=new Float32Array(this.closed.length);this.lowerDelta=new Float32Array(this.closed.length);
    this.build();
    this.collider={terrain:this,left:-100000,right:100000,top:-100000,bottom:100000};
  }
  curveSegments(points,r0,r1,count,id){
    const result=[];let prev=points[0];
    for(let i=1;i<=count;i++){
      const t=i/count,u=1-t;
      const p=[u*u*u*points[0][0]+3*u*u*t*points[1][0]+3*u*t*t*points[2][0]+t*t*t*points[3][0],
        u*u*u*points[0][1]+3*u*u*t*points[1][1]+3*u*t*t*points[2][1]+t*t*t*points[3][1]];
      const dx=p[0]-prev[0],dy=p[1]-prev[1];
      result.push({x:prev[0],y:prev[1],dx,dy,l2:dx*dx+dy*dy,r:r0+(r1-r0)*(i-1)/count,dr:(r1-r0)/count,id});prev=p;
    }
    return result;
  }
  addPath(points,r0,r1,guide=false){
    const id=this.paths.length,segs=this.curveSegments(points,r0,r1,32,id);this.paths.push(points);this.segments.push(...segs);
    if(guide){const list=guide==='lower'?this.lowerGuides:guide==='bypass'?this.bypassGuides:guide==='return'?this.returnGuides:this.guides;if(!list.length)list.push(points[0]);for(let i=3;i<segs.length;i+=4)list.push([segs[i].x+segs[i].dx,segs[i].y+segs[i].dy]);}
  }
  indexSegments(){
    for(const seg of this.segments){
      const reach=seg.r+265,b=this.bucketSize;
      for(let y=Math.floor((Math.min(seg.y,seg.y+seg.dy)-reach)/b);y<=Math.floor((Math.max(seg.y,seg.y+seg.dy)+reach)/b);y++)
        for(let x=Math.floor((Math.min(seg.x,seg.x+seg.dx)-reach)/b);x<=Math.floor((Math.max(seg.x,seg.x+seg.dx)+reach)/b);x++){
          const key=x+','+y;if(!this.buckets.has(key))this.buckets.set(key,[]);this.buckets.get(key).push(seg);
        }
    }
  }
  segmentDistance(x,y,s){
    const t=Math.max(0,Math.min(1,((x-s.x)*s.dx+(y-s.y)*s.dy)/s.l2));
    return Math.hypot(x-s.x-t*s.dx,y-s.y-t*s.dy)-s.r-t*s.dr;
  }
  union(a,b,k=22){const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25;}
  cap(d){return d<120?d:120+60*Math.sin(Math.min(1,(d-120)/120)*Math.PI/2);}
  noise(x,y){return 2.6*Math.sin(x/173+y/213)+1.8*Math.sin(y/79-x/186)+.65*Math.sin(x/53+y/97);}
  gateMask(x,y,b=this.gateBounds){
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
    return smooth(Math.min(x-b.left,b.left+b.width-x)/45)*smooth(Math.min(y-b.top,b.top+b.height-y)/45);
  }
  build(){
    const distances=new Float64Array(this.paths.length);
    for(let j=0;j<this.ny;j++)for(let i=0;i<this.nx;i++){
      const x=this.left+i*this.step,y=this.top+j*this.step,index=j*this.nx+i;
      let d=10000;
      for(const [cx,cy,rx,ry] of this.rooms){
        const px=x-cx,py=y-cy,k0=Math.hypot(px/rx,py/ry);
        const rd=(k0-1)*Math.min(rx,ry);d=this.union(d,rd,26);
      }
      distances.fill(10000);
      const candidates=this.buckets.get(Math.floor(x/this.bucketSize)+','+Math.floor(y/this.bucketSize));
      if(candidates)for(const s of candidates){const value=this.segmentDistance(x,y,s);if(value<distances[s.id])distances[s.id]=value;}
      for(let k=0;k<distances.length;k++)d=this.union(d,distances[k],22);
      for(const [cx,cy,rx,ry]of topoLayout.islands||[]){
        const ridge=(Math.hypot((x-cx)/rx,(y-cy)/ry)-1)*Math.min(rx,ry);
        d=-this.union(-d,ridge,18);
      }
      const n=this.noise(x,y),closed=this.cap(d)+n;this.closed[index]=closed;
      const mask=this.gateMask(x,y);
      if(mask>0){
        let tunnel=10000;for(const seg of this.gatePath)tunnel=Math.min(tunnel,this.segmentDistance(x,y,seg));
        this.delta[index]=(this.cap(d+(this.union(d,tunnel,20)-d)*mask)+n)-closed;
      }
      const lowerMask=topoLayout.lowerGate?this.gateMask(x,y,topoLayout.lowerGate.bounds):0;
      if(lowerMask>0){
        let tunnel=10000;for(const seg of this.lowerGatePath)tunnel=Math.min(tunnel,this.segmentDistance(x,y,seg));
        this.lowerDelta[index]=(this.cap(d+(this.union(d,tunnel,20)-d)*lowerMask)+n)-closed;
      }
    }
  }
  sample(x,y,opening=this.opening,secondary=this.secondaryOpening){
    let fx=Math.max(0,Math.min(this.nx-1.001,(x-this.left)/this.step));
    let fy=Math.max(0,Math.min(this.ny-1.001,(y-this.top)/this.step));
    const i=Math.floor(fx),j=Math.floor(fy);fx-=i;fy-=j;
    const q=j*this.nx+i,a=this.closed,b=this.delta,c=this.lowerDelta;
    const v0=a[q]+b[q]*opening+c[q]*secondary,v1=a[q+1]+b[q+1]*opening+c[q+1]*secondary,v2=a[q+this.nx]+b[q+this.nx]*opening+c[q+this.nx]*secondary,v3=a[q+this.nx+1]+b[q+this.nx+1]*opening+c[q+this.nx+1]*secondary;
    return (v0+(v1-v0)*fx)*(1-fy)+(v2+(v3-v2)*fx)*fy;
  }
  collide(p,clearance=0){
    for(let k=0;k<3;k++){
      const value=this.sample(p.x,p.y);if(value<=-clearance-.18)return;
      const gx=(this.sample(p.x+2,p.y)-this.sample(p.x-2,p.y))*.25;
      const gy=(this.sample(p.x,p.y+2)-this.sample(p.x,p.y-2))*.25;
      const g2=gx*gx+gy*gy;if(g2<.0001)return;
      const signedDistance=value/Math.sqrt(g2);if(signedDistance<=-clearance-.18)return;
      const shift=Math.min(60,Math.max(0,signedDistance+clearance+.22));
      p.x-=gx/Math.sqrt(g2)*shift;p.y-=gy/Math.sqrt(g2)*shift;
    }
  }
  coreContact(x,y,r){
    if(this.sample(x,y)<-r-8)return {value:-1,x,y};
    let result={value:-Infinity,x,y};
    for(const [dx,dy]of this.coreDirections){const px=x+dx*r,py=y+dy*r,value=this.sample(px,py);if(value>result.value)result={value,x:px,y:py};}
    return result;
  }
  lineBlocked(ax,ay,bx,by){
    const count=Math.max(2,Math.ceil(Math.hypot(bx-ax,by-ay)/7));
    for(let i=1;i<count;i++){const t=i/count;if(this.sample(ax+(bx-ax)*t,ay+(by-ay)*t)>0)return true;}return false;
  }
}
const heightMap=new ContourField();

class ContourPainting {
  constructor(field){
    this.field=field;this.base=null;this.gates=[];this.lowerGates=[];this.gateSteps=14;
    this.lineFrame=document.createElement('canvas');
    this.lineContext=this.lineFrame.getContext('2d');
    this.waveFrame=document.createElement('canvas');
    this.waveContext=this.waveFrame.getContext('2d');
    this.padding=0;
  }
  prepare(){
    const f=this.field;
    this.base=this.region(0,0,f.nx,f.ny,0);
    const b=f.gateBounds;
    this.gx=Math.floor((b.left-f.left)/f.step);this.gy=Math.floor((b.top-f.top)/f.step);
    this.gw=Math.ceil(b.width/f.step)+2;this.gh=Math.ceil(b.height/f.step)+2;
    for(let i=1;i<=this.gateSteps;i++)this.gates[i]=this.region(this.gx,this.gy,this.gw,this.gh,i/this.gateSteps);
    if(topoLayout.lowerGate){
      const b=topoLayout.lowerGate.bounds;
      this.lx=Math.floor((b.left-f.left)/f.step);this.ly=Math.floor((b.top-f.top)/f.step);
      this.lw=Math.ceil(b.width/f.step)+2;this.lh=Math.ceil(b.height/f.step)+2;
      for(let i=1;i<=this.gateSteps;i++)this.lowerGates[i]=this.region(this.lx,this.ly,this.lw,this.lh,0,i/this.gateSteps);
    }
  }
  color(h,gx,gy){
    const t=Math.max(0,Math.min(1,(h+8)/32)),green=t*t*(3-2*t);
    const depth=Math.max(0,Math.min(1,-h/280)),high=Math.max(0,Math.min(1,h/140));
    const floor=(topoLayout.palette?.floor||[235,233,221]).map((v,i)=>v+depth*[8,7,12][i]);
    const ridge=(topoLayout.palette?.ridge||[205,213,187]).map((v,i)=>v-high*[20,18,16][i]);
    const light=Math.max(-3,Math.min(3,(-gx*.55-gy*.8)*2.4));
    return floor.map((v,i)=>Math.round(v+(ridge[i]-v)*green+light));
  }
  region(i0,j0,nx,ny,opening,secondary=0){
    const f=this.field,step=f.step,values=new Float32Array(nx*ny);
    const low=document.createElement('canvas');low.width=nx;low.height=ny;
    const lowCtx=low.getContext('2d'),pixels=lowCtx.createImageData(nx,ny);
    for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
      const source=(j+j0)*f.nx+i+i0,value=f.closed[source]+f.delta[source]*opening+f.lowerDelta[source]*secondary;
      values[j*nx+i]=value;
      const x=f.left+(i+i0)*step,y=f.top+(j+j0)*step;
      const gx=(f.sample(x+3,y,opening,secondary)-f.sample(x-3,y,opening,secondary))/6;
      const gy=(f.sample(x,y+3,opening,secondary)-f.sample(x,y-3,opening,secondary))/6;
      const c=this.color(value,gx,gy),q=(j*nx+i)*4;
      pixels.data[q]=c[0];pixels.data[q+1]=c[1];pixels.data[q+2]=c[2];pixels.data[q+3]=255;
    }
    lowCtx.putImageData(pixels,0,0);
    const canvas=document.createElement('canvas');canvas.width=(nx-1)*step;canvas.height=(ny-1)*step;
    const c=canvas.getContext('2d');
    const ox=f.left+i0*step,oy=f.top+j0*step;
    c.save();c.translate(-ox,-oy);
    // The same world-space paper fibres survive the opening of the seam.
    for(let y=Math.floor(oy/14)*14;y<oy+canvas.height+14;y+=14)for(let x=Math.floor(ox/14)*14;x<ox+canvas.width+14;x+=14){
      let v=(Math.imul(x,73856093)^Math.imul(y,19349663))>>>0;v=Math.imul(v^(v>>>13),1274126177)>>>0;
      const px=x+(v&255)/18,py=y+((v>>>8)&255)/18;
      c.fillStyle=v&1024?'rgba(61,72,54,.065)':'rgba(255,255,248,.25)';c.fillRect(px,py,.45+(v&3)*.3,.5);
    }
    c.restore();
    for(let level=-392,n=0;level<=192;level+=8,n++){
      const path=this.contour(values,nx,ny,level);
      c.strokeStyle=topoLayout.palette?(level>=0?'rgba('+topoLayout.palette.line+','+(n%4===0?.7:.5)+')':'rgba('+topoLayout.palette.line+','+(n%4===0?.37:.25)+')'):level>=0?(n%4===0?'rgba(75,99,78,.77)':'rgba(96,117,93,.63)'):
        (n%4===0?'rgba(133,146,121,.48)':'rgba(153,162,138,.37)');
      c.lineWidth=n%4===0?.95:.58;c.lineCap='round';c.lineJoin='round';c.stroke(path);
    }
    return {paper:low,lines:canvas};
  }
  contour(values,nx,ny,level){
    const vertices=new Map(),step=this.field.step;
    const pairings=[[],[[3,0]],[[0,1]],[[3,1]],[[1,2]],null,[[0,2]],[[3,2]],[[2,3]],[[0,2]],null,[[1,2]],[[3,1]],[[0,1]],[[3,0]],[]];
    for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
      const q=y*nx+x,v0=values[q],v1=values[q+1],v2=values[q+nx+1],v3=values[q+nx];
      const code=(v0>level?1:0)|(v1>level?2:0)|(v2>level?4:0)|(v3>level?8:0);
      if(code===0||code===15)continue;
      const center=(v0+v1+v2+v3)*.25;
      let pairs=pairings[code];
      if(code===5)pairs=center>level?[[0,1],[2,3]]:[[3,0],[1,2]];
      if(code===10)pairs=center>level?[[3,0],[1,2]]:[[0,1],[2,3]];
      const edge=e=>{
        let id,px,py,a,b;
        if(e===0){id=q*2;a=v0;b=v1;px=x;py=y;}
        if(e===1){id=(q+1)*2+1;a=v1;b=v2;px=x+1;py=y;}
        if(e===2){id=(q+nx)*2;a=v3;b=v2;px=x;py=y+1;}
        if(e===3){id=q*2+1;a=v0;b=v3;px=x;py=y;}
        if(vertices.has(id))return vertices.get(id);
        const t=Math.abs(b-a)<1e-10?.5:(level-a)/(b-a);
        if(e===0||e===2)px+=t;else py+=t;
        const v={x:px*step,y:py*step,links:[],seen:false};vertices.set(id,v);return v;
      };
      for(const [a,b]of pairs){const va=edge(a),vb=edge(b);va.links.push(vb);vb.links.push(va);}
    }
    const path=new Path2D();
    const trace=start=>{
      if(start.seen)return;const points=[];let previous=null,current=start,closed=false;
      while(current&&!current.seen){
        current.seen=true;points.push(current);
        const next=current.links.find(v=>v!==previous);previous=current;current=next;
        if(current===start){closed=true;break;}
      }
      if(points.length<2)return;
      const first=points[0],last=points[points.length-1];
      if(closed){
        path.moveTo((first.x+last.x)/2,(first.y+last.y)/2);
        for(let i=0;i<points.length;i++){const p=points[i],n=points[(i+1)%points.length];path.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2);}path.closePath();
      }else{
        path.moveTo(first.x,first.y);
        for(let i=1;i<points.length-1;i++){const p=points[i],n=points[i+1];path.quadraticCurveTo(p.x,p.y,(p.x+n.x)/2,(p.y+n.y)/2);}path.lineTo(last.x,last.y);
      }
    };
    for(const v of vertices.values())if(v.links.length===1)trace(v);
    for(const v of vertices.values())trace(v);
    return path;
  }
  draw(c,opening,secondary=0,time=null){
    const f=this.field;
    const regions=[{image:this.base,x:f.left,y:f.top}];
    const frame=Math.max(0,Math.min(this.gateSteps,Math.round(opening*this.gateSteps)));
    if(frame)regions.push({image:this.gates[frame],x:f.left+this.gx*f.step,y:f.top+this.gy*f.step});
    const lower=Math.max(0,Math.min(this.gateSteps,Math.round(secondary*this.gateSteps)));
    if(lower&&this.lowerGates[lower])regions.push({image:this.lowerGates[lower],x:f.left+this.lx*f.step,y:f.top+this.ly*f.step});

    const transform=c.getTransform();
    if(time!==null){
      const requiredPadding=Math.max(transform.a,transform.d)*6;
      this.padding=Math.max(this.padding,Math.ceil(requiredPadding/32)*32);
    }
    const padding=time===null?0:this.padding;
    const width=c.canvas.width+2*padding,height=c.canvas.height+2*padding;
    this.resizeFrame(this.lineFrame,width,height);
    const lines=this.lineContext;
    lines.resetTransform();lines.clearRect(0,0,width,height);
    lines.setTransform(transform.a,0,0,transform.d,transform.e+padding,transform.f+padding);
    for(const {image,x,y} of regions){
      const {paper,lines:contours}=image;
      c.drawImage(paper,0,0,paper.width-1,paper.height-1,x,y,contours.width,contours.height);
      if(image!==this.base)lines.clearRect(x,y,contours.width,contours.height);
      lines.drawImage(contours,x,y);
    }

    c.save();
    c.resetTransform();
    if(time===null)c.drawImage(this.lineFrame,0,0);
    else this.drawWaves(c,transform,time,padding);
    c.restore();
  }
  resizeFrame(canvas,width,height){
    if(canvas.width!==width||canvas.height!==height){
      canvas.width=width;
      canvas.height=height;
    }
  }
  drawWaves(c,transform,time,padding){
    const {width,height}=this.lineFrame;
    this.resizeFrame(this.waveFrame,width,height);
    const wave=this.waveContext;
    wave.resetTransform();wave.clearRect(0,0,width,height);

    // Warp only the engraving. Each strip interpolates the shifts at its
    // edges so neighboring strips join, even over a moving gate patch.
    const horizontal=y=>{
      const worldY=(y-padding-transform.f)/transform.d;
      return transform.a*(3.4*Math.sin(worldY/204-time*.53)+1.6*Math.sin(worldY/86+time*.38));
    };
    const vertical=x=>{
      const worldX=(x-padding-transform.e)/transform.a;
      return transform.d*(2.8*Math.sin(worldX/178+time*.47)+1.2*Math.sin(worldX/93-time*.34));
    };
    const rowHeight=Math.max(8,Math.round(transform.d*32));
    let start=horizontal(0);
    for(let y=0;y<height;y+=rowHeight){
      const size=Math.min(rowHeight,height-y);
      const end=horizontal(y+size),shear=(end-start)/size;
      wave.setTransform(1,0,shear,1,start-y*shear,0);
      wave.drawImage(this.lineFrame,0,y,width,size,0,y,width,size);
      start=end;
    }

    const columnWidth=Math.max(8,Math.round(transform.a*32));
    start=vertical(padding);
    for(let x=padding;x<width-padding;x+=columnWidth){
      const size=Math.min(columnWidth,width-padding-x);
      const end=vertical(x+size),shear=(end-start)/size;
      c.setTransform(1,shear,0,1,-padding,start-x*shear-padding);
      c.drawImage(this.waveFrame,x,0,size,height,x,0,size,height);
      start=end;
    }
  }
}
