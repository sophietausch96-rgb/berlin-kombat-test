// /game.js
/* Berlin Kombat – korrigiert:
   - Start→Arena→Chars Flow (show('chars') Fix)
   - Auswahlkarten: Spread-Fix
   - Settings: echtes Overlay + Scroll-Lock
   - Projektil-Syntax: y: this.y-100 (Fix)
*/
window.addEventListener("DOMContentLoaded", () => {

/* ---------- Screens ---------- */
const screens = {
  start: document.getElementById("screen-start"),
  arena: document.getElementById("screen-arena"),
  chars: document.getElementById("screen-characters"),
  fight: document.getElementById("screen-fight"),
  loading: document.getElementById("screen-loading"),
  result: document.getElementById("screen-result"),
};
function show(name){
  const el = screens[name];
  if(!el){ console.warn(`Unknown screen "${name}"`); return; } // why: harte Crashes vermeiden
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  el.classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ---------- Audio ---------- */
const bgm = document.getElementById("bgm");
let audioEnabled = true;
window.addEventListener("load", async ()=>{ try{ bgm.volume=.5; await bgm.play(); }catch{} });

/* ---------- Basic SFX ---------- */
const AudioFX = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = AC ? new AC() : null;
  if(!ctx) return { punch(){}, kick(){}, special(){}, hit(){}, ko(){}, whoosh(){} };
  const master = ctx.createGain(); master.gain.value=.7; master.connect(ctx.destination);
  const on=()=>audioEnabled;
  const blip=(o)=>{ if(!on())return; const t=ctx.currentTime;
    const osc=ctx.createOscillator(), g=ctx.createGain();
    osc.type=o.type||"square"; osc.frequency.value=o.freq||200;
    g.gain.value=o.vol||.6; g.gain.exponentialRampToValueAtTime(0.001, t+(o.dur||.1));
    osc.connect(g); g.connect(master); osc.start(); osc.stop(t+(o.dur||.1));
  };
  const noise=(dur=.1,vol=.3)=>{ if(!on())return;
    const b=ctx.createBuffer(1,ctx.sampleRate*dur,ctx.sampleRate);
    const d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
    const s=ctx.createBufferSource(); s.buffer=b;
    const g=ctx.createGain(); g.gain.value=vol; s.connect(g); g.connect(master);
    s.start(); s.stop(ctx.currentTime+dur);
  };
  return {
    punch(){ blip({freq:160,dur:.07}); noise(.05,.25); },
    kick(){ blip({freq:90,dur:.09,type:"sawtooth"}); },
    special(){ blip({freq:420,dur:.16,type:"triangle"}); },
    hit(){ noise(.1,.45); },
    ko(){ blip({freq:70,dur:.25,type:"sawtooth"}); },
    whoosh(){ blip({freq:300,dur:.05,type:"triangle"}); }
  };
})();

/* ---------- Data ---------- */
const ARENAS = [
  { id:"kotti", name:"Kottbusser Tor", src:"kottbusser-tor.png" },
  { id:"sanssouci", name:"Park Sanssouci", src:"park-sanssouci.png" },
];
const CHARS = [
  { id:"sophie", name:"Sophie Stahlfinger", subline:"Bio-Bizeps Kick", src:"sophie-avatar.png",
    intro:"Ick bin Bio und gefährlich!", winQuotes:["Alles Bio, Baby.","Da glüht die Zahnbürste nich!"], special:"bioBall" },
  { id:"zoe", name:"Zoe Zehnschuss", subline:"Kotti-Klatsche mit der Zahnbürste", src:"zoe-avatar.png",
    intro:"Ick putz dir gleich deine Zähne!", winQuotes:["Saubere Sache!","Zehn von zehn Treffern."], special:"toothSpin" },
  { id:"charly", name:"Club-Mate Charly", subline:"Currywurst Chop auf die Nase", src:"charly-avatar.png",
    intro:"Erst Mate, dann Klatsche!", winQuotes:["War wohl zu viel Koffein.","Club-Mate über Alles!"], special:"mateBlast" },
  { id:"elly", name:"Error Elly 404", subline:"Hackt dein Hirn, bevor du \"Ctrl+Z\" sagen kannst", src:"elly-avatar.png",
    intro:"Ping. Pong. Dein Hirn: 404.", winQuotes:["Stack overflow in deinem Gesicht.","Bug report: Du bist raus."], special:"dataSpike" },
];

/* ---------- Globals ---------- */
let selectedArena=null, selectedChar=null;
let canvas, ctx, game=null, lastTime=0;
const vfxLayer = document.getElementById("vfxLayer");
const keys = Object.create(null);
addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if(e.key==="Escape"){ if(!closeSettings(true)) togglePause(); }
});
addEventListener("keyup",   e => { keys[e.key.toLowerCase()] = false; });

/* ---------- Selection UI ---------- */
const arenaGrid = document.getElementById("arena-grid");
ARENAS.forEach(a=>{
  const card=document.createElement("div");
  card.className="card";
  card.innerHTML=`<img class="thumb" src="${a.src}" alt="${a.name}"/><div class="caption"><h3>${a.name}</h3></div>`;
  card.onclick=()=>{
    [...arenaGrid.children].forEach(c=>c.classList.remove("selected")); // why: vorheriger Tippfehler killte JS
    card.classList.add("selected");
    selectedArena=a;
    document.getElementById("btn-arena-next").disabled=false;
  };
  arenaGrid.appendChild(card);
});

document.getElementById("btn-start").onclick = ()=> show("arena");
document.getElementById("btn-arena-next").onclick = ()=>{
  buildCharGrid();
  show("chars"); // Fix: richtiger Key
};
document.getElementById("btn-back-start").onclick=()=> show("start");

function buildCharGrid(){
  const grid=document.getElementById("char-grid"); grid.innerHTML="";
  CHARS.forEach(c=>{
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=`<img class="thumb" src="${c.src}" alt="${c.name}"/><div class="caption"><h3>${c.name}</h3><p class="subline">${c.subline}</p></div>`;
    card.onclick=()=>{
      [...grid.children].forEach(x=>x.classList.remove("selected"));
      card.classList.add("selected"); selectedChar=c;
      document.getElementById("btn-char-play").disabled=false;
    };
    grid.appendChild(card);
  });
}
document.getElementById("btn-char-play").onclick=()=>{
  if(!selectedArena||!selectedChar) return;
  show("loading"); setTimeout(()=>startGame(selectedArena,selectedChar),500);
};
document.getElementById("btn-back-arena").onclick=()=> show("arena");
document.getElementById("btn-exit").onclick=()=> show("start");
document.getElementById("btn-restart").onclick=()=> show("start");

/* ---------- Settings Modal ---------- */
const settingsModal = document.getElementById("settingsModal");
const btnSettings   = document.getElementById("btn-settings");
const btnCloseSet   = document.getElementById("btn-close-settings");
const btnDoneSet    = document.getElementById("btn-done-settings");
const chkSound      = document.getElementById("toggle-sound");
const btnAudio      = document.getElementById("btn-audio");

function lockScroll(lock){
  document.documentElement.style.overflow = lock ? "hidden" : "";
  document.body.style.overflow = lock ? "hidden" : "";
}
function openSettings(){
  if(settingsModal.classList.contains("hidden")){
    settingsModal.classList.remove("hidden");
    settingsModal.setAttribute("aria-hidden","false");
    lockScroll(true); // why: Modal soll nicht „unter“ dem Canvas hängen
  }
}
function closeSettings(){
  if(!settingsModal.classList.contains("hidden")){
    settingsModal.classList.add("hidden");
    settingsModal.setAttribute("aria-hidden","true");
    lockScroll(false);
    return true;
  }
  return false;
}
btnSettings?.addEventListener("click", openSettings);
btnCloseSet?.addEventListener("click", closeSettings);
btnDoneSet?.addEventListener("click", closeSettings);
chkSound?.addEventListener("change", e=>{
  audioEnabled = e.target.checked;
  if(!audioEnabled){ try{ bgm.pause(); }catch{} } else { try{ bgm.play(); }catch{} }
});
btnAudio?.addEventListener("click", ()=>{
  if(bgm.paused){ bgm.play().catch(()=>{}); } else { bgm.pause(); }
});

/* =========================================================
   Core
   ======================================================= */
const W=960,H=540,FLOOR=H-60, GRAV=22;
const STAMINA_MAX=100, HEALTH_MAX=100;
const TOTAL_ROUNDS=3, ROUNDS_TO_WIN=2, ROUND_TIME=60;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function rectsIntersect(a,b){ return !(a.x>b.x+b.w || a.x+a.w<b.x || a.y>b.y+b.h || a.y+a.h<b.y); }

/* Input */
const Input={ _prev:{}, _now:{},
  update(){ this._prev={...this._now}; this._now={...keys}; },
  press(k){ return this._now[k]&&!this._prev[k]; },
  hold(k){ return !!this._now[k]; }
};

/* Fighter */
class Fighter{
  constructor(cfg,x,dir,ai=false){
    Object.assign(this,cfg);
    this.img=new Image(); this.img.src=cfg.src;
    this.aspect=1; this.img.onload=()=>{ this.aspect=this.img.naturalWidth/this.img.naturalHeight||1; };
    this.x=x; this.y=FLOOR; this.dir=dir; this.ai=ai;
    this.vx=0; this.vy=0; this.hp=HEALTH_MAX; this.st=STAMINA_MAX;
    this.state="idle"; this.stateT=0; this.cool=0; this.hurtTint=0;
    this.projectiles=[]; this.aiThink=0;
    this._pendingHit=null;
  }
  width(){ return 190*this.aspect; }
  height(){ return 190; }
  bounds(){ return {x:this.x-this.width()/2,y:this.y-this.height(),w:this.width(),h:this.height()}; }
  get isGround(){ return this.y>=FLOOR-0.001; }
  setState(s,d=.25){ if(this.state!=="ko"){ this.state=s; this.stateT=d; } }

  update(dt,input,op){
    if(this.stateT>0) this.stateT-=dt;
    if(this.hurtTint>0) this.hurtTint-=300*dt;
    if(this.cool>0) this.cool-=dt;
    if(this.state==="idle"||this.state==="walk") this.st=clamp(this.st+20*dt,0,STAMINA_MAX);

    if(game.phase==="fight"){
      if(this.ai) this.aiUpdate(dt,op); else this.playerUpdate(dt,input,op);
    }else{ this.vx *= 0.94; }

    this.vy += GRAV*dt; this.y += this.vy; this.x += this.vx*dt;
    if(this.y>=FLOOR){ this.y=FLOOR; this.vy=0; }
    this.x = clamp(this.x,60,W-60);

    this.updateProjectiles(dt,op);
    this._processPendingHit(dt,op);
  }

  takeHit(dmg,heavy=false){
    if(this.state==="ko") return;
    if(this.state==="block" && this.st>0){ dmg=Math.ceil(dmg*.35); this.st=clamp(this.st-8,0,STAMINA_MAX); }
    this.hp = clamp(this.hp-dmg,0,HEALTH_MAX);
    this.hurtTint=120; this.setState("hurt",heavy?.35:.18);
    AudioFX.hit();
    if(this.hp<=0){ this.vy=-8; this.setState("ko",2.0); AudioFX.ko(); }
  }

  fireSpecial(){
    if(this.st<20) return; this.st=Math.max(0,this.st-20);
    const push=(r,color,dmg,vy=-100,extra={})=>
      this.projectiles.push({x:this.x+this.dir*60, y:this.y-100, r, color, vx:this.dir*460, vy, dmg, life:1200, type:extra.type||"normal", t:0, amp:extra.amp||0, freq:extra.freq||0}); // FIX: y:
    if(this.special==="bioBall")  push(11,"#8fef8f",10,-90);
    if(this.special==="toothSpin") push(14,"#fff5cc",12,-60);
    if(this.special==="mateBlast") push(16,"#ffcf66",14,-110);
    if(this.special==="dataSpike") push(12,"#7ee0ff",11,-70,{type:"zigzag",amp:120,freq:16});
    AudioFX.special();
  }

  updateProjectiles(dt,op){
    this.projectiles = this.projectiles.filter(p=>{
      p.t += dt;
      if(p.type==="zigzag"){ p.vx += Math.sin(p.t*p.freq) * p.amp * dt * this.dir * 0.6; p.vy += Math.cos(p.t*p.freq*.7)*20*dt; }
      p.vy += GRAV*.5*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt*1000;
      const hb={x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2};
      if(rectsIntersect(hb,op.bounds())){ op.takeHit(p.dmg,true); return false; }
      return p.life>0 && p.x>-120 && p.x<W+120 && p.y>-120 && p.y<H+120;
    });
  }

  playerUpdate(dt,input,opp){
    this.dir = (opp.x>=this.x)?1:-1;
    const speed=260;
    if(input.hold("a")){ this.vx=-speed; this.setState("walk",.05); }
    else if(input.hold("d")){ this.vx=speed; this.setState("walk",.05); }
    else this.vx=0;
    if(input.press("w")&&this.isGround){ this.vy=-10.2; this.setState("jump",.24); AudioFX.whoosh(); }
    if(input.press("s")) this.setState("block",.3);
    if(this.cool<=0){
      if(input.press("f")) this.attack("jab",opp);
      if(input.press("g")) this.attack("kick",opp);
      if(input.press("h")) this.attack("special",opp);
    }
  }

  aiUpdate(dt,opp){
    this.aiThink-=dt;
    if(this.aiThink<=0){
      this.aiThink=.12+Math.random()*.15;
      const dist=opp.x-this.x; this.dir=dist>0?1:-1; const abs=Math.abs(dist);
      this.vx=0;
      if(abs>320){ this.vx=150*this.dir; if(Math.random()<.06) this.fireSpecial(); }
      else if(abs>140){ this.vx=170*this.dir; if(Math.random()<.18) this.setState("block",.2); }
      else{
        if(this.cool<=0){ const r=Math.random(); if(r<.45) this.attack("jab",opp); else if(r<.8) this.attack("kick",opp); else this.attack("special",opp); }
      }
    }
  }

  attack(kind,opp){
    if(this.state==="block") return;
    let dmg=7,reach=118,heavy=false,cd=.34,start=.06,active=.10,recover=.22;
    if(kind==="jab"){ dmg=7; reach=118; cd=.28; start=.06; active=.08; recover=.18; AudioFX.punch(); }
    if(kind==="kick"){ dmg=12; reach=136; cd=.34; start=.10; active=.10; recover=.22; heavy=true; AudioFX.kick(); }
    if(kind==="special"){ this.setState("attack",.22); this.fireSpecial(); this.cool=.26; return; }
    this.setState("attack", start+active+recover);
    this.cool=cd;
    this._pendingHit={ tStart:start, tEnd:start+active, dmg, reach, heavy, applied:false };
  }

  _processPendingHit(dt,opp){
    const ph=this._pendingHit; if(!ph) return;
    ph.tStart-=dt; ph.tEnd-=dt;
    if(!ph.applied && ph.tStart<=0){
      const xStart=this.dir===1?(this.x+20):(this.x-ph.reach-20);
      const box={x:xStart, y:this.y-this.height()+54, w:ph.reach+40, h:82};
      if(rectsIntersect(box,opp.bounds())){ opp.takeHit(ph.dmg,ph.heavy); }
      ph.applied=true;
    }
    if(ph.tEnd<=0) this._pendingHit=null;
  }

  draw(ctx){
    // projectiles
    this.projectiles.forEach(p=>{ ctx.save(); ctx.translate(p.x,p.y); ctx.fillStyle=p.color; ctx.globalAlpha=.9; ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); ctx.restore(); });
    // sprite
    ctx.save(); ctx.translate(this.x,this.y); if(this.dir===-1) ctx.scale(-1,1);
    let rot=0,dy=0; if(this.state==="walk") dy -= 3*Math.sin(game.time*14);
    if(this.state==="hurt") rot -= .12; if(this.state==="attack") rot += .10; if(this.state==="ko"){ rot=-1.2; dy+=12; }
    ctx.rotate(rot); ctx.translate(0,-this.height()+dy);
    const w=this.width(), h=this.height();
    ctx.drawImage(this.img,-w/2,0,w,h);
    ctx.restore();
    // short tint
    if(this.hurtTint>0){ const b=this.bounds(); ctx.globalAlpha=.25; ctx.fillStyle="rgba(255,80,80,.25)"; ctx.fillRect(b.x-6,b.y-6,b.w+12,b.h+12); ctx.globalAlpha=1; }
    // shadow
    ctx.fillStyle="rgba(0,0,0,.28)"; ctx.beginPath(); ctx.ellipse(this.x,FLOOR,54,12,0,0,Math.PI*2); ctx.fill();
  }
}

/* Helpers */
const easeOutBack = (t)=>{ const c1=1.70158; const c3=c1+1; return 1 + c3*Math.pow(t-1,3) + c1*Math.pow(t-1,2); };

/* Game State */
function startGame(arena,charCfg){
  canvas=document.getElementById("gameCanvas"); ctx=canvas.getContext("2d");
  const arenaImg=new Image();
  arenaImg.onload=()=>{
    const p1=new Fighter(charCfg, -200, 1, false);
    const others = CHARS.filter(c=>c.id!==charCfg.id);
    const oppCfg = others[Math.floor(Math.random()*others.length)];
    const p2=new Fighter(oppCfg, W+200, -1, true);

    game={
      arenaImg, p1, p2,
      phase:"intro",
      round:1, p1Wins:0, p2Wins:0, totalRounds:TOTAL_ROUNDS,
      timer:ROUND_TIME,
      message:`${p1.name}: ${p1.intro} • ${p2.name}: ${p2.intro}`,
      messageT:3,
      time:0, introT:0, outroT:0,
      paused:false
    };

    document.getElementById("p1Name").textContent=p1.name;
    document.getElementById("p2Name").textContent=p2.name;

    show("fight"); lastTime=performance.now(); requestAnimationFrame(loop);
  };
  arenaImg.src=arena.src;
}

function togglePause(){ if(!game||game.phase!=="fight") return; game.paused=!game.paused; game.message = game.paused? "PAUSE":"FIGHT!"; game.messageT=1; }
function loop(t){ if(!game) return; const dt=Math.min(0.05,(t-lastTime)/1000); lastTime=t; update(dt); draw(); requestAnimationFrame(loop); }

/* Update */
function update(dt){
  game.time += dt; Input.update();
  if(game.messageT>0) game.messageT -= dt;

  if(game.phase==="intro"){
    const dur=1.2; game.introT=Math.min(dur, game.introT+dt); const p=easeOutBack(game.introT/dur);
    game.p1.x = -200 + p*(240-(-200));
    game.p2.x =  W+200 + p*(720-(W+200));
    if(game.introT>=dur){ game.phase="fight"; game.message="FIGHT!"; game.messageT=1.2; }
    return;
  }

  if(game.phase==="outro"){
    const dur=1.1; game.outroT=Math.min(dur, game.outroT+dt); const p=easeOutBack(game.outroT/dur);
    const loser = game.roundWinner===game.p1 ? game.p2 : game.p1;
    loser.x += (loser.dir===1?-1:1) * 420 * dt * p;
    if(game.outroT>=dur){
      if(game.p1Wins>=ROUNDS_TO_WIN || game.p2Wins>=ROUNDS_TO_WIN || game.round>=TOTAL_ROUNDS){
        setTimeout(()=> showResult(game.roundWinner), 600);
      } else {
        setTimeout(()=> setupNextRound(), 500);
      }
    }
    return;
  }

  if(game.phase==="fight"){
    if(game.paused) return;
    game.timer -= dt;
    if(game.timer<=0){ const rw=(game.p1.hp===game.p2.hp)?(Math.random()<.5?game.p1:game.p2):(game.p1.hp>game.p2.hp?game.p1:game.p2); endRound(rw); return; }
    game.p1.update(dt, Input, game.p2);
    game.p2.update(dt, null,  game.p1);
    if(game.p1.hp<=0){ endRound(game.p2); return; }
    if(game.p2.hp<=0){ endRound(game.p1); return; }
    updateBars();
  }
}

/* Draw */
function draw(){
  const g=game; if(!g) return;
  ctx.clearRect(0,0,W,H);
  ctx.drawImage(g.arenaImg,0,0,W,H);
  g.p1.draw(ctx); g.p2.draw(ctx);
  document.getElementById("roundTag").textContent = g.messageT>0 ? g.message : `ROUND ${g.round}`;
  document.getElementById("timer").textContent = (g.phase==="fight") ? Math.max(0,Math.ceil(g.timer)) : "";
}

/* UI Bars */
function updateBars(){
  const set=(id,val)=> document.getElementById(id).style.width=`${Math.max(0,Math.min(100,val))}%`;
  set("p1Health",(game.p1.hp/HEALTH_MAX)*100);
  set("p2Health",(game.p2.hp/HEALTH_MAX)*100);
  set("p1Stamina",(game.p1.st/STAMINA_MAX)*100);
  set("p2Stamina",(game.p2.st/STAMINA_MAX)*100);
  document.getElementById("p1Wins").textContent = "●".repeat(game.p1Wins);
  document.getElementById("p2Wins").textContent = "●".repeat(game.p2Wins);
}

/* Rounds */
function endRound(winner){
  if(game.phase!=="fight") return;
  if(winner===game.p1) game.p1Wins++; else game.p2Wins++;
  game.phase="outro"; game.outroT=0; game.roundWinner=winner;
  const q = (winner.winQuotes && winner.winQuotes.length)? winner.winQuotes[Math.floor(Math.random()*winner.winQuotes.length)] : "Victory!";
  game.message = `${winner.name} gewinnt Runde ${game.round}! – ${q}`;
  game.messageT = 3;
}
function setupNextRound(){
  game.round++;
  game.timer=ROUND_TIME;
  game.phase="intro"; game.introT=0;
  const p1cfg=CHARS.find(c=>c.name===game.p1.name);
  const p2cfg=CHARS.find(c=>c.name===game.p2.name);
  game.p1 = new Fighter(p1cfg, -200, 1, false);
  game.p2 = new Fighter(p2cfg, W+200, -1, true);
  game.message = `${game.p1.name}: ${game.p1.intro} • ${game.p2.name}: ${game.p2.intro}`;
  game.messageT = 2.2;
  updateBars();
}
function showResult(champ){
  document.getElementById("winnerAvatar").src = champ.src;
  document.getElementById("resultText").textContent = `${champ.name} gewinnt das Match!`;
  show("result");
}

}); // DOMContentLoaded
