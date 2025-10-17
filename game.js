// /game.js
// Berlin Kombat – Phaser-Version (FSM, Hitfenster, Sparks, stabile Screens)
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
  const el = screens[name]; if(!el){ console.warn(`Unknown screen "${name}"`); return; }
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  el.classList.add("active");
  window.scrollTo({ top: 0, behavior: "instant" });
}

/* ---------- Audio ---------- */
const bgm = document.getElementById("bgm");
let audioEnabled = true;
window.addEventListener("load", async ()=>{ try{ bgm.volume=.5; await bgm.play(); }catch{} });

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
let phaserGame=null; // wichtig: zum Destroy beim Neustart
const W=960,H=540,FLOOR=H-60;

/* ---------- Selection UI ---------- */
const arenaGrid = document.getElementById("arena-grid");
ARENAS.forEach(a=>{
  const card=document.createElement("div");
  card.className="card";
  card.innerHTML=`<img class="thumb" src="${a.src}" alt="${a.name}"/><div class="caption"><h3>${a.name}</h3></div>`;
  card.onclick=()=>{[...arenaGrid.children].forEach(c=>c.classList.remove("selected")); card.classList.add("selected"); selectedArena=a; document.getElementById("btn-arena-next").disabled=false;};
  arenaGrid.appendChild(card);
});
document.getElementById("btn-start").onclick=()=> show("arena");
document.getElementById("btn-arena-next").onclick=()=>{ buildCharGrid(); show("chars"); };
document.getElementById("btn-back-start").onclick=()=> show("start");

function buildCharGrid(){
  const grid=document.getElementById("char-grid"); grid.innerHTML="";
  CHARS.forEach(c=>{
    const card=document.createElement("div"); card.className="card";
    card.innerHTML=`<img class="thumb" src="${c.src}" alt="${c.name}"/><div class="caption"><h3>${c.name}</h3><p class="subline">${c.subline}</p></div>`;
    card.onclick=()=>{ [...grid.children].forEach(x=>x.classList.remove("selected")); card.classList.add("selected"); selectedChar=c; document.getElementById("btn-char-play").disabled=false; };
    grid.appendChild(card);
  });
}
document.getElementById("btn-char-play").onclick=()=>{ if(!selectedArena||!selectedChar) return; show("loading"); startGame(selectedArena,selectedChar); };
document.getElementById("btn-back-arena").onclick=()=> show("arena");

/* ---------- Settings Modal ---------- */
const settingsModal=document.getElementById("settingsModal");
function lockScroll(lock){ document.documentElement.style.overflow=lock?"hidden":""; document.body.style.overflow=lock?"hidden":""; }
function openSettings(){ if(settingsModal.classList.contains("hidden")){ settingsModal.classList.remove("hidden"); settingsModal.setAttribute("aria-hidden","false"); lockScroll(true);} }
function closeSettings(){ if(!settingsModal.classList.contains("hidden")){ settingsModal.classList.add("hidden"); settingsModal.setAttribute("aria-hidden","true"); lockScroll(false); return true;} return false; }
document.getElementById("btn-settings")?.addEventListener("click",openSettings);
document.getElementById("btn-close-settings")?.addEventListener("click",closeSettings);
document.getElementById("btn-done-settings")?.addEventListener("click",closeSettings);
document.getElementById("toggle-sound")?.addEventListener("change",e=>{ audioEnabled=e.target.checked; if(!audioEnabled){ try{bgm.pause();}catch{} } else { try{bgm.play();}catch{} }});
document.getElementById("btn-audio")?.addEventListener("click",()=>{ if(bgm.paused){ bgm.play().catch(()=>{});} else { bgm.pause(); }});
document.getElementById("btn-exit").onclick=()=> resetToArena();
document.getElementById("btn-restart").onclick=()=> resetToArena();

/* ---------- Phaser Integration ---------- */
function destroyPhaser(){ if(phaserGame){ phaserGame.destroy(true); phaserGame=null; const host=document.getElementById("phaserHost"); if(host) host.innerHTML=""; } }

function startGame(arena,charCfg){
  destroyPhaser(); // sauber starten
  const others = CHARS.filter(c=>c.id!==charCfg.id);
  const oppCfg = others[Math.floor(Math.random()*others.length)];

  const FightScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize:
    function FightScene(){ Phaser.Scene.call(this, { key: "FightScene" }); },

    init(){
      this.dataArena = arena;
      this.p1cfg = charCfg;
      this.p2cfg = oppCfg;
      this.round = 1; this.p1Wins=0; this.p2Wins=0;
      this.timeLeft = 60;
      this.state = "intro"; // intro -> fight -> outro
    },

    preload(){
      this.load.image("arena", this.dataArena.src);
      this.load.image("p1", this.p1cfg.src);
      this.load.image("p2", this.p2cfg.src);
      // 1x1 Pixel + Funken-Textur erzeugen
      const g1=this.make.graphics({x:0,y:0,add:false}); g1.fillStyle(0xffffff).fillRect(0,0,1,1); g1.generateTexture("px",1,1); g1.destroy();
      const g2=this.make.graphics({x:0,y:0,add:false}); g2.fillStyle(0xffe6a3).fillCircle(4,4,4); g2.generateTexture("spark",8,8); g2.destroy();
    },

    create(){
      // World
      this.add.image(W/2,H/2,"arena").setDisplaySize(W,H);
      this.physics.world.setBounds(0,0,W,H);
      const ground = this.add.rectangle(W/2, FLOOR, W, 10, 0x000000, 0);
      this.physics.add.existing(ground,true);

      // Fighters
      this.p1 = this.spawnFighter(240, 1, "p1", this.p1cfg);
      this.p2 = this.spawnFighter(720,-1, "p2", this.p2cfg, true);

      this.physics.add.collider(this.p1.body, ground);
      this.physics.add.collider(this.p2.body, ground);

      // Inputs
      this.keys = this.input.keyboard.addKeys({left:"A",right:"D",up:"W",down:"S",J:"F",K:"G",L:"H",ESC:"ESC"});

      // Particles
      this.sparks = this.add.particles(0,0,"spark");
      this.emitter = this.sparks.createEmitter({ x:0, y:0, speed:{min:-160,max:160}, lifespan:280, quantity:0, scale:{start:1,end:0}, blendMode:"ADD" });

      // HUD
      document.getElementById("p1Name").textContent=this.p1cfg.name;
      document.getElementById("p2Name").textContent=this.p2cfg.name;
      document.getElementById("roundTag").textContent="ROUND 1";
      document.getElementById("timer").textContent = this.timeLeft.toString();

      // Intro Slide-In
      this.tweens.add({ targets:this.p1, x:240, duration:700, ease:"Back.Out", onStart:()=>{ this.p1.x=-200; } });
      this.tweens.add({ targets:this.p2, x:720, duration:700, ease:"Back.Out", onStart:()=>{ this.p2.x=W+200; }, onComplete:()=>{ this.state="fight"; this.announce("FIGHT!", 1000); } });

      // ESC Pause
      this.keys.ESC.on("down", ()=>{ this.scene.pause(); this.announce("PAUSE", 800); });
      this.input.keyboard.on("keydown-P", ()=>{ this.scene.resume(); });

      // Round Timer
      this.timerEvent = this.time.addEvent({ delay:1000, loop:true, callback:()=>{
        if(this.state!=="fight") return;
        this.timeLeft = Math.max(0, this.timeLeft-1);
        document.getElementById("timer").textContent = this.timeLeft.toString();
        if(this.timeLeft===0){ this.endRound(this.p1.hp>=this.p2.hp?this.p1:this.p2); }
      }});
    },

    spawnFighter(x, dir, key, cfg, ai=false){
      const spr = this.physics.add.image(x, FLOOR-5, key).setOrigin(0.5,1).setImmovable(false);
      spr.setDisplaySize(190, 190);
      spr.setCollideWorldBounds(true);
      spr.dir = dir; spr.ai = ai;
      spr.state="idle"; spr.hp=100; spr.st=100; spr.cool=0; spr.pending=null; spr.hitbox=null;

      // visible shadow
      const sh = this.add.ellipse(x, FLOOR, 54, 12, 0x000000, 0.28).setOrigin(0.5);
      this.tweens.add({ targets: sh, duration: 100, repeat: -1 });

      spr.shadow = sh;

      // helper
      spr.face = (targetX)=>{ spr.dir = targetX>=spr.x ? 1 : -1; spr.setFlipX(spr.dir===-1); };
      spr.takeHit = (dmg,heavy=false)=>{
        const real = (spr.state==="block" && spr.st>0)? Math.ceil(dmg*0.35): dmg;
        if(spr.state==="block" && spr.st>0) spr.st = Math.max(0, spr.st-8);
        spr.hp = Math.max(0, spr.hp - real);
        this.flashTint(spr, heavy);
        if(spr.hp<=0){ spr.state="ko"; spr.setVelocityY(-200); }
      };

      // physics body size
      spr.body.setSize(60, 140).setOffset(-30, -140);

      return spr;
    },

    update(time, delta){
      const dt = delta/1000;
      if(this.state!=="fight") return;

      // Inputs / AI
      this.updateFighter(this.p1, dt, this.p2, this.keys);
      this.updateAI(this.p2, dt, this.p1);

      // HUD
      setBar("p1Health", this.p1.hp);
      setBar("p2Health", this.p2.hp);
      setBar("p1Stamina", this.p1.st);
      setBar("p2Stamina", this.p2.st);

      // Round end
      if(this.p1.hp<=0) this.endRound(this.p2);
      else if(this.p2.hp<=0) this.endRound(this.p1);
    },

    updateFighter(f, dt, opp, keys){
      // Facing
      f.face(opp.x);

      // Cooldowns / regen
      if(f.cool>0) f.cool -= dt;
      if(f.state==="idle"||f.state==="walk") f.st = Math.min(100, f.st + 20*dt);

      // Movement
      const speed=260;
      const left=keys.left.isDown, right=keys.right.isDown;
      if(left){ f.setVelocityX(-speed); f.state="walk"; }
      else if(right){ f.setVelocityX(speed); f.state="walk"; }
      else { f.setVelocityX(0); if(f.state==="walk") f.state="idle"; }

      if(keys.up.isDown && f.body.blocked.down){ f.setVelocityY(-420); f.state="jump"; }
      if(keys.down.isDown){ f.state="block"; }

      // Attacks
      if(f.cool<=0){
        if(Phaser.Input.Keyboard.JustDown(keys.J)) this.startAttack(f,"jab",opp);
        if(Phaser.Input.Keyboard.JustDown(keys.K)) this.startAttack(f,"kick",opp);
        if(Phaser.Input.Keyboard.JustDown(keys.L)) this.startSpecial(f);
      }

      // Pending hit window
      const ph=f.pending;
      if(ph){
        ph.tStart -= dt; ph.tEnd -= dt;
        if(!ph.applied && ph.tStart<=0){
          const reach=ph.reach, xStart=f.dir===1?(f.x+20):(f.x-reach-20);
          if(!f.hitbox){
            f.hitbox = this.physics.add.image(xStart, f.y-90, "px").setVisible(false);
            f.hitbox.body.setAllowGravity(false);
          }
          f.hitbox.setPosition(xStart, f.y-90);
          f.hitbox.body.setSize(reach+40, 82).setOffset(-(reach+40)/2, -41);

          const overlap = this.physics.overlap(f.hitbox, ph.opp);
          if(overlap){ ph.opp.takeHit(ph.dmg, ph.heavy);
            this.emitter.explode(10, ph.opp.x, ph.opp.y-120);
            ph.applied=true;
          }
        }
        if(ph.tEnd<=0){ f.pending=null; if(f.hitbox){ f.hitbox.destroy(); f.hitbox=null; } f.state="idle"; }
      }

      // KO drift
      if(f.state==="ko"){ f.setVelocityX((f.dir===1?-1:1)*100); }
      f.shadow.setPosition(f.x, FLOOR);
    },

    updateAI(f, dt, opp){
      if(!f) return;
      // simple distances
      const dist = opp.x - f.x; const abs=Math.abs(dist);
      f.face(opp.x);

      if(f.cool<=0){
        if(abs>320){ f.setVelocityX(150*(f.dir)); if(Math.random()<.03) this.startSpecial(f); }
        else if(abs>160){ f.setVelocityX(160*(f.dir)); if(Math.random()<.12) f.state="block"; }
        else{ f.setVelocityX(0); const r=Math.random(); if(r<.5) this.startAttack(f,"jab",opp); else this.startAttack(f,"kick",opp); }
      }
    },

    startAttack(f, kind, opp){
      if(f.state==="block"||f.state==="ko") return;
      const moves={ jab:{dmg:7, reach:118, start:.06, active:.08, recover:.18, cd:.28},
                    kick:{dmg:12,reach:136, start:.10, active:.10, recover:.22, cd:.34} };
      const m=moves[kind]; if(!m) return;
      f.state="attack"; f.cool = m.cd;
      f.pending = { tStart:m.start, tEnd:m.start+m.active, dmg:m.dmg, reach:m.reach, heavy:(kind==="kick"), opp, applied:false };
    },

    startSpecial(f){
      if(f.st<20) return; f.st=Math.max(0,f.st-20);
      // kurzer Dash + Funken (Placeholder-Special)
      f.state="attack"; f.cool=.26;
      const vx=420*f.dir; this.tweens.add({ targets:f, x: f.x + f.dir*80, duration:120, onStart:()=>{ f.setVelocityX(vx); } , onComplete:()=>{ f.setVelocityX(0); f.state="idle"; }});
      this.emitter.explode(12, f.x+f.dir*40, f.y-100);
    },

    flashTint(spr, heavy){
      spr.setTintFill(0xff5a5a); this.time.delayedCall(80, ()=> spr.clearTint());
      if(heavy) this.cameras.main.shake(90, 0.004);
    },

    announce(text, dur=1000){
      document.getElementById("roundTag").textContent=text;
      this.time.delayedCall(dur, ()=>{ document.getElementById("roundTag").textContent=`ROUND ${this.round}`; });
    },

    endRound(winner){
      if(this.state!=="fight") return;
      this.state="outro";
      if(winner===this.p1) this.p1Wins++; else this.p2Wins++;
      document.getElementById("p1Wins").textContent="●".repeat(this.p1Wins);
      document.getElementById("p2Wins").textContent="●".repeat(this.p2Wins);
      this.announce(`${winner===this.p1?this.p1cfg.name:this.p2cfg.name} gewinnt Runde ${this.round}!`, 1500);

      // Aus dem Bild sliden
      const loser = (winner===this.p1)?this.p2:this.p1;
      this.tweens.add({ targets:loser, x: loser.x + (loser.dir===1?-1:1)*420, duration:800, ease:"Back.In" });

      this.time.delayedCall(1100, ()=>{
        if(this.p1Wins>=2 || this.p2Wins>=2 || this.round>=3){
          // Match-Ende
          const champ = (this.p1Wins>this.p2Wins)? this.p1cfg : this.p2cfg;
          onMatchEnd(champ);
        }else{
          // Nächste Runde
          this.round++; this.timeLeft=60; document.getElementById("timer").textContent="60";
          document.getElementById("roundTag").textContent=`ROUND ${this.round}`;
          // neue Fighter (hp/st reset)
          this.p1.hp=100; this.p2.hp=100; this.p1.st=100; this.p2.st=100;
          this.p1.setPosition(240,FLOOR-5); this.p2.setPosition(720,FLOOR-5);
          this.state="intro";
          this.tweens.add({ targets:this.p1, x:240, duration:600, ease:"Back.Out", onStart:()=>{ this.p1.x=-200; } });
          this.tweens.add({ targets:this.p2, x:720, duration:600, ease:"Back.Out", onStart:()=>{ this.p2.x=W+200; }, onComplete:()=>{ this.state="fight"; this.announce("FIGHT!", 900); } });
        }
      });
    },
  });

  // Phaser Config
  phaserGame = new Phaser.Game({
    type: Phaser.AUTO,
    width: W, height: H,
    parent: "phaserHost",
    backgroundColor: "#0b0d12",
    physics: { default: "arcade", arcade: { gravity: { y: 980 }, debug: false } },
    scene: [FightScene]
  });

  // UI → Fight-Screen anzeigen
  show("fight");
}

/* ---------- HUD helpers ---------- */
function setBar(id, val){ document.getElementById(id).style.width = `${Math.max(0,Math.min(100,val))}%`; }

/* ---------- Result / Restart ---------- */
function onMatchEnd(champ){
  document.getElementById("winnerAvatar").src = champ.src;
  document.getElementById("resultText").textContent = `${champ.name} gewinnt das Match!`;
  show("result");
}
function resetToArena(){
  destroyPhaser();
  selectedArena=null; selectedChar=null;
  // UI reset
  const next=document.getElementById("btn-arena-next"); if(next) next.disabled=true;
  if(arenaGrid) [...arenaGrid.children].forEach(c=>c.classList.remove("selected"));
  const charGrid=document.getElementById("char-grid"); if(charGrid){ charGrid.innerHTML=""; const play=document.getElementById("btn-char-play"); if(play) play.disabled=true; }
  closeSettings();
  show("arena");
}

}); // DOMContentLoaded
