'use strict';
class GameSound {
  constructor(button){
    this.button=button;
    this.voices=new Set();
    this.muted=false;
    try{this.muted=localStorage.getItem('ottisk-muted')==='1';}catch{}
    this.available=Boolean(window.AudioContext||window.webkitAudioContext);
    button.disabled=!this.available;
    this.label();
    button.onclick=()=>{
      if(this.active)this.muted=true;else this.muted=false;
      try{localStorage.setItem('ottisk-muted',this.muted?'1':'0');}catch{}
      if(this.muted)this.silence();else this.activate();
      this.label();
    };
  }
  get active(){return !this.muted&&this.context?.state==='running';}
  label(){
    this.button.setAttribute('aria-pressed',String(Boolean(this.active)));
    this.button.title=this.available?(this.active?'Выключить звук':'Включить звук'):'Звук недоступен';
    this.button.setAttribute('aria-label',this.button.title);
  }
  activate(){
    if(!this.available||this.muted)return;
    if(!this.context){
      const ac=new (window.AudioContext||window.webkitAudioContext)();
      this.context=ac;
      this.master=ac.createGain();this.master.gain.value=.52;this.master.connect(ac.destination);
      this.noise=ac.createBuffer(1,ac.sampleRate,ac.sampleRate);
      const samples=this.noise.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;
      this.roll=ac.createBufferSource();this.roll.buffer=this.noise;this.roll.loop=true;
      this.railFilter=ac.createBiquadFilter();this.railFilter.type='bandpass';this.railFilter.Q.value=1.1;
      this.railGain=ac.createGain();this.railGain.gain.value=0;
      this.roll.connect(this.railFilter).connect(this.railGain).connect(this.master);this.roll.start();
      ac.onstatechange=()=>this.label();
    }
    if(this.context.state!=='running')this.context.resume().then(()=>this.label()).catch(()=>this.label());
    this.label();
  }
  silence(){
    if(!this.context)return;
    this.lastRoll=undefined;
    this.railGain.gain.cancelScheduledValues(this.context.currentTime);
    this.railGain.gain.value=0;
    for(const src of this.voices)src.stop();
  }
  rolling(amount){
    if(!this.active||document.hidden||amount===this.lastRoll)return;
    this.lastRoll=amount;
    const now=this.context.currentTime;
    this.railGain.gain.setTargetAtTime(amount*.21,now,.035);
    this.railFilter.frequency.setTargetAtTime(260+amount*750,now,.05);
  }
  voice(type,hz,endHz,duration,volume,delay=0){
    if(!this.active)return;
    const ac=this.context,start=ac.currentTime+delay,end=start+duration;
    const hiss=type==='noise',src=hiss?ac.createBufferSource():ac.createOscillator();
    const filter=hiss?ac.createBiquadFilter():null;
    const gain=ac.createGain();
    if(hiss){
      src.buffer=this.noise;src.loop=true;filter.type='bandpass';
      src.connect(filter).connect(gain);
    }else{src.type=type;src.connect(gain);}
    const frequency=(filter||src).frequency;
    frequency.setValueAtTime(hz,start);frequency.exponentialRampToValueAtTime(endHz,end);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(volume,start+.009);
    gain.gain.exponentialRampToValueAtTime(.0001,end);gain.connect(this.master);
    this.voices.add(src);
    src.onended=()=>{this.voices.delete(src);src.disconnect();filter?.disconnect();gain.disconnect();};
    if(hiss)src.start(start,Math.random()*.75);else src.start(start);
    src.stop(end+.012);
  }
  play(event,power=1){
    if(!this.active)return;
    switch(event){
      case 'step': this.voice('noise',1250+Math.random()*550,680,.079,.12*power);break;
      case 'bump': this.voice('sine',165,59,.14,.32*power);this.voice('noise',880,240,.085,.14*power);break;
      case 'corner': this.voice('triangle',390,160,.13,.19);break;
      case 'seat': this.voice('triangle',690,520,.26,.19);this.voice('sine',1050,1020,.31,.08,.03);break;
      case 'seal': this.voice('sine',83,37,.85,.3);this.voice('noise',170,1050,.65,.11,.045);this.voice('sine',172,89,.7,.1,.08);break;
      case 'portal': this.voice('noise',280,920,.7,.12);this.voice('sine',104,185,.85,.13);this.voice('triangle',530,370,.55,.06,.15);break;
      case 'printer': this.voice('noise',145,630,3.8,.15);this.voice('sawtooth',49,77,3.5,.035);this.voice('noise',1600,410,1.2,.055,2.2);break;
      case 'circuit': this.voice('sine',390,780,.2,.12);this.voice('triangle',120,62,.16,.13,.08);break;
      case 'rollerWarn': this.voice('triangle',1400,360,.055,.14);this.voice('noise',240,530,.85,.045,.12);break;
      case 'rollerPress': this.voice('noise',90,450,.34,.22);this.voice('sine',70,33,.3,.24);break;
      case 'paperCrack': this.voice('noise',1650,740,.19,.14);this.voice('noise',2600,990,.1,.09,.11);break;
      case 'paperTear': this.voice('noise',2600,310,.42,.24);this.voice('sine',90,38,.27,.17);break;
      case 'overprint': this.voice('triangle',870,260,.072,.13);this.voice('noise',360,1350,.6,.12,.07);break;
      case 'companion': this.voice('sine',560,820,.145,.095);this.voice('sine',795,1020,.22,.086,.13);break;
      case 'fold': this.voice('noise',1540,450,.23,.16);this.voice('triangle',233,170,.15,.08);break;
      case 'suction': this.voice('noise',260,840,1.15,.19);this.voice('sine',130,69,.76,.1);break;
      case 'feed': this.voice('triangle',460,95,.18,.12);this.voice('noise',370,570,2.75,.14,.1);break;
      case 'lastPage': this.voice('noise',1200,490,1.5,.14);this.voice('sine',208,79,.9,.05);break;
      case 'pencil': this.voice('noise',2600,920,1.8,.09);break;
      case 'lantern': this.voice('triangle',355,67,.12,.075);this.voice('noise',1800,820,.45,.07,.1);break;
      case 'plate': this.voice('triangle',275,120,.075,.21);break;
      case 'open': this.voice('noise',480,1600,.52,.25);this.voice('sine',108,172,.38,.16);break;
      case 'flowIn': this.voice('noise',620,180,.23,.12);this.voice('sine',210,82,.28,.12);break;
      case 'flowEnd': this.voice('sine',165,91,.12,.12);this.voice('sine',590,586,.30,.10,.045);break;
      case 'inkIn': this.voice('sine',230+Math.random()*60,450,.095,.10);break;
      case 'inkOut': this.voice('sine',210,85,.10,.11);this.voice('noise',650,230,.065,.055);break;
    }
  }
}
