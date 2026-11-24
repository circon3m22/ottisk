'use strict';
// Instructions follow the player's actions, not a timer or a modal slideshow.
class FirstImprint {
  constructor(){this.stage='move';this.walked=0;this.pushTime=0;this.squeezeTime=0;this.revealed=false;this.inkLearned=false;this.shedLearned=false;}
  advance(body,weight,delta,target){
    this.walked+=delta;
    if(this.stage==='move'&&this.walked>75)this.stage='maze';
    if(body.y>1410&&(this.stage==='move'||this.stage==='maze'))this.stage='block';
    const dx=weight.x-body.x,dy=weight.y-body.y;
    const pushing=Math.hypot(dx,dy)<body.bodyRadius+55&&(target.x-body.x)*dx+(target.y-body.y)*dy>0;
    if(pushing&&body.ink<requiredInk&&!weight.seated)this.pushTime+=stepTime;
    else this.pushTime=Math.max(0,this.pushTime-stepTime*.4);
    let reveal=false;
    if(this.pushTime>.3&&!this.revealed){this.revealed=true;reveal=true;this.stage='ink';}
    if(this.revealed&&body.ink<requiredInk&&!weight.seated)this.stage='ink';
    if(this.revealed&&body.ink>=requiredInk&&!weight.seated){this.inkLearned=true;this.stage='push';}
    if(weight.seated&&this.stage!=='button'&&this.stage!=='exit')this.stage='passage';
    const atMouth=Math.abs(body.x-passage.x)<67&&body.y>passage.top-95&&body.y<passage.top+28;
    if(weight.seated&&atMouth&&body.bodyRadius>passage.maxRadius&&target.y>passage.top){
      this.squeezeTime+=stepTime;
      if(this.squeezeTime>.13)this.stage='shed';
    }
    if(this.stage==='shed'&&body.bodyRadius<=passage.maxRadius){this.shedLearned=true;this.stage='passage';}
    if(weight.seated&&body.y>passage.bottom+12&&this.stage!=='exit')this.stage='button';
    return {reveal};
  }
  get message(){
    return {move:'Двигайте мышью, чтобы вести персонажа.',maze:'Спускайтесь по листу. Найдите путь через лабиринт.',block:'Попробуйте сдвинуть круглый груз.',
      ink:'Не хватает массы. Соберите появившиеся капли.',push:'Чернил достаточно. Ведите груз по направляющей.',
      passage:'Проход открыт. Вторая кнопка за стеной.',shed:'Слишком большой. Сбросьте часть чернил.',
      button:'Нажмите вторую кнопку.',exit:'Выход открыт. Втеките в отверстие.'}[this.stage]||'';
  }
}
