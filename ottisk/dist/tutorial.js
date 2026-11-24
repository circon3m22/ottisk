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
    if(body.ink>=requiredInk&&!weight.seated&&(this.stage==='block'||this.stage==='ink'||this.stage==='push')){this.inkLearned=true;this.stage='push';}
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
      ink:'Не хватает массы. Соберите чернила в этой комнате.',push:'Чернил достаточно. Ведите груз по направляющей.',
      passage:'Проход открыт. Вторая кнопка за стеной.',shed:'Слишком большой. Сбросьте часть чернил.',
      button:'Нажмите вторую кнопку.',exit:'Выход открыт. Втеките в отверстие.'}[this.stage]||'';
  }
}

class EyeletLesson {
  constructor(){this.stage='approach';this.entered=false;this.retrieved=false;}
  advance(body,weight,delta,target,state={}){
    if(body.y>passage.bottom+24&&body.x<1000)this.entered=true;
    if(state.unlocked)this.stage='exit';
    else if(weight.seated)this.stage=!state.spoolAtStart?'reroute':body.y>2290?'finish':'lower';
    else if(state.bypassOpened){
      if(body.ink>=requiredInk){this.retrieved=true;this.stage='push';}
      else this.stage='retrieve';
    }else if(this.entered)this.stage=state.spoolSeated?'relay':'spool';
    else if(body.y>passage.top-120&&Math.abs(body.x-passage.x)<120){
      this.stage=body.bodyRadius>passage.maxRadius?'shed':'enter';
    }else this.stage='approach';
    return {reveal:false};
  }
  get message(){
    return {approach:'Впереди тесное ушко. Оставьте чернила перед входом.',
      shed:'Сбросьте чернила здесь. За ними можно вернуться.',
      enter:'Теперь пройдите внутрь петли.',
      spool:'Лёгкую шпульку можно двигать без чернил. Доведите её до контакта.',
      relay:'Контакт замкнут. Теперь нажмите кнопку обхода.',
      retrieve:'Обход открыт. Вернитесь за оставленными чернилами.',
      push:'Верните чернила внутрь. Грузу нужна ваша масса.',
      reroute:'Обход питается одним контактом. Верните шпульку в начальное гнездо для нижней петли.',
      lower:'Груз открыл нижнюю петлю. Следуйте по линии.',
      finish:'Обойдите внутренний штрих петли и нажмите нижнюю кнопку.',
      exit:'Выход открыт. Втеките в отверстие.'}[this.stage]||'';
  }
  get goal(){return {approach:'Выход находится внутри незамкнутой петли.',shed:'Тесное ушко не пропускает наполненное тело.',enter:'Внутренний контур петли ещё не замкнут.',spool:'Внешний обход обесточен.',relay:'Контакт обхода соединён.',retrieve:'Обход открыт. Ваш запас остался снаружи.',push:'Нижнюю петлю закрывает тяжёлый затвор.',reroute:'Груз на месте. Нижняя цепь всё ещё разомкнута.',lower:'Нижняя петля получила питание.',finish:'Остаётся замкнуть контур петли.',exit:'Выход открыт.'}[this.stage]||'';}
}

class PrintedLesson {
  constructor(){this.stage='print';}
  advance(){this.stage=unlocked?'exit':'print';return {reveal:false};}
  get message(){return mechanisms.message;}
  get goal(){return mechanisms.goal;}
}
