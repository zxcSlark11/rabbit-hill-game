import { CONFIG } from './config.js';
import { TEXTS } from './texts.js';

export function createUI(actions) {
  const $ = selector => document.querySelector(selector);
  const menu=$('#menu'), chargeScreen=$('#charge-screen'), runHud=$('#run-hud'), result=$('#result');
  const chargeButton=$('#charge');
  let eventTimer;
  $('h1').textContent=TEXTS.title;
  $('.subtitle').textContent=TEXTS.menuSubtitle;
  $('#play').textContent=TEXTS.play;
  $('.charge-title').textContent=TEXTS.chargePrompt;
  chargeButton.textContent=TEXTS.chargeButton;
  $('#continue').textContent=TEXTS.continue;
  $('#result h2').textContent=TEXTS.resultTitle;
  $('#play').addEventListener('click',actions.onPlay);
  $('#continue').addEventListener('click',actions.onContinue);
  document.querySelectorAll('[data-upgrade]').forEach(button=>button.addEventListener('click',()=>actions.onUpgrade(button.dataset.upgrade)));
  chargeButton.addEventListener('pointerdown',event=>{event.preventDefault();chargeButton.setPointerCapture(event.pointerId);actions.onChargeStart();});
  for(const type of ['pointerup','pointercancel','lostpointercapture']) chargeButton.addEventListener(type,actions.onChargeEnd);
  return {
    showMenu(progress,costs) {
      menu.hidden=false; chargeScreen.hidden=true; runHud.hidden=true; result.hidden=true;
      $('#wallet').textContent=progress.carrots;
      $('#sling-effect').textContent=`${TEXTS.slingEffect} ×${(1+progress.slingLevel*CONFIG.slingPowerPerLevel).toFixed(2)}`;
      $('#sled-effect').textContent=`${TEXTS.sledEffect} ${Math.round(100/(1+progress.sledLevel*CONFIG.sledFrictionReduction))}% · ${TEXTS.sledVisualHint}`;
      $('#income-effect').textContent=`${TEXTS.money} ×${1+progress.incomeLevel*CONFIG.incomeMultiplierPerLevel}`;
      for(const key of ['sling','sled','income']) {
        const level=progress[`${key}Level`];
        $(`#${key}-level`).textContent=`Ур. ${level}`;
        const steps=level>=CONFIG.maxUpgradeLevels[key]?CONFIG.upgradeStepsPerTier:level%CONFIG.upgradeStepsPerTier;
        const tier=key==='income'?null:Math.min(CONFIG.maxVisualTiers[key],Math.floor(level/CONFIG.upgradeStepsPerTier));
        const progressBar=$(`#${key}-progress`);
        [...progressBar.children].forEach((block,index)=>block.classList.toggle('filled',index<steps));
        progressBar.setAttribute('aria-label',`${steps} из ${CONFIG.upgradeStepsPerTier} улучшений до следующего уровня`);
        $(`#${key}-stage`).textContent=key==='income'?`Этап · ${steps}/5`:`Вид ${tier} · ${steps}/5`;
        const cost=costs[key]; const label=$(`#${key}-cost`);
        label.textContent=cost===null?'МАКС':`🥕 ${cost}`;
        const button=$(`[data-upgrade="${key}"]`); button.disabled=cost===null||progress.carrots<cost;
      }
    },
    showCharge() { menu.hidden=true; chargeScreen.hidden=false; runHud.hidden=true; result.hidden=true; this.setCharge(0); },
    setCharge(value) { const pct=Math.round(value*100); $('#charge-fill').style.width=`${pct}%`; $('#charge-value').textContent=`${pct}%`; },
    startRun() { chargeScreen.hidden=true; runHud.hidden=false; $('#distance').textContent='0 м'; $('#speed').textContent='0 км/ч'; },
    updateRun(distance,speed,biome,bestDistance,mapLength) {
      $('#distance').textContent=`${Math.floor(distance)} м`; $('#speed').textContent=`${Math.round(speed*3.6)} км/ч`; $('#biome').textContent=biome;
      $('#run-fill').style.height=`${Math.min(1,distance/mapLength)*100}%`;
      $('#best-marker').style.bottom=`${Math.min(1,bestDistance/mapLength)*100}%`;
      $('#best-label').textContent=`Рекорд ${Math.floor(bestDistance)} м`;
    },
    showEvent(message) { $('#event').textContent=message;clearTimeout(eventTimer);eventTimer=setTimeout(()=>$('#event').textContent='',1000); },
    showResult(distance,multiplier,reward,bestDistance) {
      runHud.hidden=true; result.hidden=false;
      $('#result-distance').textContent=`${Math.floor(distance)} м`;
      $('#result-best').textContent=`${Math.floor(bestDistance)} м`;
      $('#result-multiplier').textContent=`×${multiplier}`;
      $('#reward').textContent=reward;
    },
  };
}
