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
      case 'plate': this.voice('triangle',275,120,.075,.21);break;
      case 'open': this.voice('noise',480,1600,.52,.25);this.voice('sine',108,172,.38,.16);break;
      case 'flowIn': this.voice('noise',620,180,.23,.12);this.voice('sine',210,82,.28,.12);break;
      case 'flowEnd': this.voice('sine',165,91,.12,.12);this.voice('sine',590,586,.30,.10,.045);break;
      case 'inkIn': this.voice('sine',230+Math.random()*60,450,.095,.10);break;
      case 'inkOut': this.voice('sine',210,85,.10,.11);this.voice('noise',650,230,.065,.055);break;
    }
  }
}
