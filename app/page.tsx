"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Screen = "intro" | "setup" | "fight" | "over";
type Move = "punch" | "kick" | "special" | "block";
type Mode = "cpu" | "duo";
type Arena = "bras" | "luz" | "tatuape" | "guaianases" | "itaquera";
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const stages: { arena: Arena; name: string }[] = [
  { arena: "bras", name: "Brás" },
  { arena: "luz", name: "Luz" },
  { arena: "tatuape", name: "Tatuapé" },
  { arena: "guaianases", name: "Guaianases" },
  { arena: "itaquera", name: "Corinthians–Itaquera" },
];

const fighters = [
  { id: "alfa", name: "Agente Alfa", style: "Ágil", special: "Cassetetada", side: "left" },
  { id: "bravo", name: "Agente Bravo", style: "Força", special: "Impacto na Plataforma", side: "right" },
  { id: "agente-feminina", name: "Agente Feminina", style: "Velocidade", special: "Cassetetada", side: "left" },
  { id: "marreta", name: "Marreta", style: "Malandragem", special: "Venda Casada", side: "left" },
  { id: "evelyn", name: "Evelyn S.", style: "Liderança", special: "Golpe de Comando", side: "left" },
] as const;

export default function Home() {
  const [screen, setScreen] = useState<Screen>("intro");
  const mode: Mode = "cpu";
  const [difficulty, setDifficulty] = useState("normal");
  const [stage, setStage] = useState(0);
  const [stageTransition, setStageTransition] = useState<string | null>(null);
  const arena = stages[stage].arena;
  const [p1Choice, setP1Choice] = useState(0);
  const p1Name = p1Choice === 4 ? "EVELYN S." : p1Choice === 2 ? "AGENTE FEMININA" : "AGENTE";
  const p2Choice = 3;
  const p2Name = "RIVAL";
  const [hp, setHp] = useState<[number, number]>([100, 100]);
  const [energy, setEnergy] = useState<[number, number]>([25, 25]);
  const [wins, setWins] = useState<[number, number]>([0, 0]);
  const [position, setPosition] = useState<[number, number]>([15, 65]);
  const [verticalPosition, setVerticalPosition] = useState<[number, number]>([16, 16]);
  const [moves, setMoves] = useState<[string, string]>(["idle", "idle"]);
  const [time, setTime] = useState(60);
  const [message, setMessage] = useState("PREPARE-SE");
  const [combo, setCombo] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [muted, setMuted] = useState(false);
  const [stats, setStats] = useState({ victories: 0, bestCombo: 0 });
  const locked = useRef(false);
  const comboAt = useRef(0);
  const punchStreak = useRef(0);
  const lastPunchAt = useRef(0);
  const hpRef = useRef<[number, number]>([100, 100]);
  const winsRef = useRef<[number, number]>([0, 0]);
  const afastaAudio = useRef<HTMLAudioElement | null>(null);
  const ossAudio = useRef<HTMLAudioElement | null>(null);
  const youtubeFrame = useRef<HTMLIFrameElement | null>(null);
  const themeContext = useRef<AudioContext | null>(null);
  const themeTimer = useRef<number | null>(null);
  const themeStep = useRef(0);
  const directionLoop = useRef<number | null>(null);

  useEffect(() => {
    try { const saved = localStorage.getItem("bras-fighters-stats"); if (saved) setStats(JSON.parse(saved)); } catch {}
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setIsIos(ios); setIsInstalled(standalone);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPromptEvent); };
    const installed = () => { setIsInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("beforeinstallprompt", beforeInstall); window.removeEventListener("appinstalled", installed); };
  }, []);

  const installApp = useCallback(async () => {
    if (isIos || !installPrompt) { setShowInstallHelp(true); return; }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);
    setInstallPrompt(null);
  }, [installPrompt, isIos]);

  const playMusic = useCallback(() => {
    setMuted(false);
    window.setTimeout(() => youtubeFrame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "playVideo", args: [] }), "*"), 50);
  }, []);

  const pauseMusic = useCallback(() => {
    youtubeFrame.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
    setMuted(true);
  }, []);

  const sound = useCallback((tone = 160, length = .07) => {
    if (muted) return;
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
      osc.frequency.value = tone; osc.type = "square"; gain.gain.setValueAtTime(.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + length);
      osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + length);
      window.setTimeout(() => void ctx.close(), (length + .08) * 1000);
    } catch {}
  }, [muted]);

  const shoutAfasta = useCallback(() => {
    if (muted) return;
    if (!afastaAudio.current) afastaAudio.current = new Audio("/afasta.mp3");
    afastaAudio.current.currentTime = 0;
    afastaAudio.current.volume = 1;
    void afastaAudio.current.play().catch(() => {});
  }, [muted]);

  const shoutOss = useCallback(() => {
    if (muted) return;
    if (!ossAudio.current) ossAudio.current = new Audio("/oss.mp3");
    ossAudio.current.currentTime = 0; ossAudio.current.volume = 1;
    void ossAudio.current.play().catch(() => {});
  }, [muted]);

  const animate = (index: 0 | 1, move: string) => {
    setMoves(v => index === 0 ? [move, v[1]] : [v[0], move]);
    window.setTimeout(() => setMoves(v => index === 0 ? ["idle", v[1]] : [v[0], "idle"]), move === "special" ? 620 : 330);
  };

  const endRound = useCallback((winner: 0 | 1) => {
    if (locked.current) return;
    locked.current = true; sound(80, .35);
    const next: [number, number] = [...winsRef.current] as [number, number]; next[winner] += 1;
    winsRef.current = next; setWins(next); setMessage(winner === 0 ? `${p1Name} VENCEU!` : `${p2Name} VENCEU!`);
    window.setTimeout(() => {
      if (next[winner] >= 2) {
        if (winner === 0 && stage < stages.length - 1) {
          const nextStage = stage + 1;
          setStageTransition(stages[nextStage].name);
          setMessage("NÍVEL CONCLUÍDO!");
          window.setTimeout(() => {
            const freshWins: [number,number] = [0,0]; winsRef.current = freshWins; hpRef.current = [100,100];
            setStage(nextStage); setWins(freshWins); setHp([100,100]); setEnergy([20,45]); setPosition([15,65]); setTime(60); setCombo(0);
            setMessage(`FASE ${nextStage + 1} — LUTEM!`); setStageTransition(null); locked.current = false;
          }, 2300);
        } else {
          if (winner === 0) {
          setStats(old => { const value = { victories: old.victories + 1, bestCombo: Math.max(old.bestCombo, combo) }; localStorage.setItem("bras-fighters-stats", JSON.stringify(value)); return value; });
          }
          setScreen("over");
        }
      } else {
        hpRef.current = [100,100]; setHp([100,100]); setEnergy([25,25]); setPosition([15,65]); setTime(60); setCombo(0);
        setMessage(`ROUND ${next[0] + next[1] + 1} — LUTEM!`); locked.current = false;
      }
    }, 1300);
  }, [combo, p1Name, p2Name, sound, stage]);

  const act = useCallback((attacker: 0 | 1, move: Move) => {
    if (screen !== "fight" || locked.current) return;
    const defender = attacker === 0 ? 1 : 0;
    if (move === "block") { animate(attacker, "block"); setMessage("DEFESA!"); sound(90); return; }
    if (move === "special" && energy[attacker] < 100) { setMessage("CARREGUE O ESPECIAL!"); return; }
    const distance = Math.abs(position[1] - position[0]);
    const maxRange = move === "punch" ? 30 : move === "kick" ? 34 : 38;
    if (distance > maxRange) { animate(attacker, move); setMessage("CHEGUE MAIS PERTO!"); sound(70); if (attacker === 0) punchStreak.current = 0; return; }
    const blocked = moves[defender] === "block";
    const base = move === "punch" ? 3 : move === "kick" ? 5 : 14;
    const rivalPower = attacker === 1 ? (difficulty === "hard" ? 2.7 + stage * .2 : 2.3 + stage * .17) : .92;
    const damage = blocked ? Math.max(1, Math.round(base * .2)) : Math.round(base * rivalPower);
    animate(attacker, move); animate(defender, blocked ? "block" : "hit"); sound(move === "special" ? 380 : 180 + base * 8, move === "special" ? .25 : .08);
    if (attacker === 0) {
      const now = Date.now(); const nextCombo = now - comboAt.current < 850 ? combo + 1 : 1; comboAt.current = now; setCombo(nextCombo);
      if (move === "punch") {
        punchStreak.current = now - lastPunchAt.current < 1200 ? punchStreak.current + 1 : 1;
        lastPunchAt.current = now;
      } else punchStreak.current = 0;
      if (move === "special") shoutOss();
      if (punchStreak.current === 3) { setMessage("AFASTA!"); punchStreak.current = 0; sound(520,.22); shoutAfasta(); }
      else if (nextCombo >= 3) setMessage(`${nextCombo} GOLPES — COMBO!`); else setMessage(move === "special" ? fighters[p1Choice].special.toUpperCase() : "ACERTOU!");
    } else setMessage(move === "special" ? fighters[p2Choice].special.toUpperCase() : "CONTRA-ATAQUE!");
    setEnergy(v => { const n: [number,number] = [...v] as [number,number]; n[attacker] = move === "special" ? 0 : Math.min(100, n[attacker] + (attacker === 1 ? 22 : 10)); n[defender] = Math.min(100, n[defender] + (defender === 1 ? 10 : 6)); return n; });
    const nextHp: [number,number] = [...hpRef.current] as [number,number]; nextHp[defender] = Math.max(0, nextHp[defender] - damage); hpRef.current = nextHp; setHp(nextHp);
    if (nextHp[defender] === 0) endRound(attacker);
  }, [combo, difficulty, endRound, energy, moves, p1Choice, position, screen, shoutAfasta, shoutOss, sound, stage]);

  const moveFighter = useCallback((who: 0 | 1, delta: number) => {
    if (screen !== "fight" || locked.current) return;
    setPosition(v => {
      const n: [number,number] = [...v] as [number,number];
      n[who] = Math.max(2, Math.min(78, n[who] + delta));
      if (Math.abs(n[1] - n[0]) < 18) n[who] = v[who];
      return n;
    });
    animate(who, "walk");
  }, [screen]);

  const moveVertical = useCallback((who: 0 | 1, delta: number) => {
    if (screen !== "fight" || locked.current) return;
    setVerticalPosition(v => {
      const n: [number,number] = [...v] as [number,number];
      n[who] = Math.max(10, Math.min(31, n[who] + delta));
      return n;
    });
    animate(who, "walk");
  }, [screen]);

  const stopDirection = useCallback(() => {
    if (directionLoop.current !== null) window.clearInterval(directionLoop.current);
    directionLoop.current = null;
  }, []);

  const holdDirection = useCallback((action: () => void) => {
    stopDirection();
    action();
    directionLoop.current = window.setInterval(action, 55);
  }, [stopDirection]);

  useEffect(() => {
    window.addEventListener("pointerup", stopDirection);
    window.addEventListener("pointercancel", stopDirection);
    window.addEventListener("blur", stopDirection);
    return () => {
      stopDirection();
      window.removeEventListener("pointerup", stopDirection);
      window.removeEventListener("pointercancel", stopDirection);
      window.removeEventListener("blur", stopDirection);
    };
  }, [stopDirection]);

  useEffect(() => {
    if (screen !== "fight") return;
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "a") moveFighter(0,-4); if (key === "d") moveFighter(0,4); if (key === "w") animate(0,"jump");
      if (key === "j") act(0,"punch"); if (key === "k") act(0,"kick"); if (key === "i") act(0,"block"); if (key === "l") act(0,"special");
      if (mode === "duo") { if (e.key === "ArrowLeft") moveFighter(1,-4); if (e.key === "ArrowRight") moveFighter(1,4); if (e.key === "ArrowUp") animate(1,"jump"); if (key === "1") act(1,"punch"); if (key === "2") act(1,"kick"); if (key === "3") act(1,"block"); if (key === "0") act(1,"special"); }
    };
    window.addEventListener("keydown",onKey); return () => window.removeEventListener("keydown",onKey);
  }, [act, mode, moveFighter, screen]);

  useEffect(() => {
    if (screen !== "fight" || mode !== "cpu") return;
    const speed = Math.max(255, (difficulty === "hard" ? 360 : 500) - stage * 32);
    const ai = window.setInterval(() => {
      if (locked.current) return;
      const dist = position[1] - position[0];
      const chance = Math.random();
      if (dist > 29) moveFighter(1,-6);
      else if (energy[1] >= 100 && chance < .58) act(1,"special");
      else if (chance < (difficulty === "hard" ? .44 : .38)) act(1,"block");
      else act(1, chance > .48 ? "kick" : "punch");
    }, speed); return () => clearInterval(ai);
  }, [act, difficulty, energy, mode, moveFighter, position, screen, stage]);

  useEffect(() => {
    if (screen !== "fight") return;
    const timer = window.setInterval(() => setTime(v => {
      if (v <= 1) { endRound(hpRef.current[0] > hpRef.current[1] ? 0 : 1); return 0; } return v - 1;
    }),1000); return () => clearInterval(timer);
  }, [endRound, screen]);

  const stopTheme = useCallback(() => {
    if (themeTimer.current !== null) window.clearInterval(themeTimer.current);
    themeTimer.current = null;
    if (themeContext.current) void themeContext.current.close().catch(() => {});
    themeContext.current = null;
  }, []);

  const startTheme = useCallback(() => {
    if (muted || themeContext.current) return;
    try {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx(); themeContext.current = ctx;
      const melody = [220, 262, 294, 330, 294, 392, 349, 294, 247, 294, 330, 440, 392, 330, 294, 262];
      const playNote = () => {
        if (!themeContext.current) return;
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.type = themeStep.current % 4 === 0 ? "sawtooth" : "square";
        osc.frequency.value = melody[themeStep.current % melody.length];
        gain.gain.setValueAtTime(.026, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16);
        osc.connect(gain); gain.connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .17);
        themeStep.current += 1;
      };
      playNote(); themeTimer.current = window.setInterval(playNote, 180);
    } catch {}
  }, [muted]);

  useEffect(() => () => stopTheme(), [stopTheme]);

  const start = () => {
    const initialWins: [number,number] = [0,0]; winsRef.current = initialWins; hpRef.current=[100,100];
    playMusic(); punchStreak.current=0; lastPunchAt.current=0; setStage(0); setStageTransition(null); setWins(initialWins); setHp([100,100]); setEnergy([20,45]); setPosition([15,65]); setVerticalPosition([16,16]); setTime(60); setCombo(0); setMessage("FASE 1 — BRÁS"); locked.current=false; setScreen("fight");
  };

  return <main className="game-shell">
    <iframe ref={youtubeFrame} className="youtube-music" title="Música da batalha" src="https://www.youtube.com/embed/coz22oUWnC0?enablejsapi=1&loop=1&playlist=coz22oUWnC0&controls=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media"/>
    <div className="scanlines" />
    <div className="rotate-device"><div className="phone-icon">↻</div><b>GIRE O CELULAR</b><span>O jogo funciona na horizontal</span></div>
    <header className={`topbar ${screen==="fight"?"during-fight":""}`}><button className="brandButton" onClick={()=>setScreen("intro")}><span>BRÁS</span> FIGHTERS <small>MOBILE</small></button><div className="header-actions"><button onClick={()=>setShowHelp(true)}>?</button><button onClick={()=>muted?playMusic():pauseMusic()}>{muted?"🔇":"🔊"}</button></div></header>

    {screen === "intro" && <section className="intro enhanced"><div className="intro-copy"><p className="eyebrow">NOVA EDIÇÃO • BATALHA FERROVIÁRIA</p><h1>BRÁS<br/><em>FIGHTERS</em></h1><p className="lead">Escolha seu agente, domine as plataformas e conquiste a Linha 11.</p><p className="creator-signature"><strong>Projeto criado por Evelyn Santos</strong></p><div className="intro-buttons"><button className="music-start" onClick={playMusic}>♫ TOCAR MÚSICA</button><button className="start" onClick={()=>setScreen("setup")}>JOGAR AGORA <span>▶</span></button><button className="ghost" onClick={()=>setShowHelp(true)}>VER CONTROLES</button>{!isInstalled&&<button className="install-app" onClick={installApp}>⬇ {isIos?"INSTALAR NO IPHONE":"INSTALAR APP"}</button>}</div><div className="records"><span>🏆 {stats.victories} vitórias</span><span>⚡ Melhor combo: {stats.bestCombo}</span></div></div><div className="versus-card"><div className="intro-fighter left"/><div className="vs">VS</div><div className="intro-fighter right"/></div></section>}

    {screen === "setup" && <section className="setup-screen"><div className="setup-heading"><p>PREPARE A BATALHA</p><h2>ESCOLHA SEU LUTADOR</h2></div><div className="setup-grid mobile-setup">
      <div className="setup-panel fighter-select"><h3>VOCÊ JOGA COMO</h3><div className="agent-options"><button className={p1Choice===0?"player-card selected":"player-card"} onClick={()=>setP1Choice(0)}><div className="mini-fighter fighter-alfa"/><div><b>AGENTE</b><small>Ágil e preparado para enfrentar o rival.</small></div></button><button className={p1Choice===2?"player-card selected":"player-card"} onClick={()=>setP1Choice(2)}><div className="mini-fighter fighter-agente-feminina"/><div><b>AGENTE FEMININA</b><small>Rápida, forte e pronta para o combate.</small></div></button><button className={p1Choice===4?"player-card selected":"player-card"} onClick={()=>setP1Choice(4)}><div className="mini-fighter fighter-evelyn"/><div><b>EVELYN S.</b><small>Liderança, agilidade e força na batalha.</small></div></button></div></div>
      <div className="setup-panel rival-panel"><h3>SEU RIVAL FIXO</h3><div className="rival-card"><div className="mini-fighter fighter-marreta"/><div><b>RIVAL</b><small>Ataca com o saco preto e não dá moleza.</small></div></div><h3>2. DIFICULDADE</h3><div className="segmented">{["normal","hard"].map((d,i)=><button key={d} className={difficulty===d?"selected":""} onClick={()=>setDifficulty(d)}>{["DESAFIANTE","DIFÍCIL"][i]}</button>)}</div><h3>3. CAMPANHA — 5 FASES</h3><div className="stage-route">{stages.map((s,i)=><span key={s.arena}><b>{i+1}</b>{s.name}</span>)}</div></div>
    </div><button className="start battle" onClick={start}>COMEÇAR BATALHA ▶</button></section>}

    {screen === "fight" && <section className="fight-wrap"><div className="hud"><FighterHud name={p1Name} hp={hp[0]} wins={wins[0]} side="p1" fighterId={fighters[p1Choice].id}/><div className="clock">{String(time).padStart(2,"0")}<small>ROUND {wins[0]+wins[1]+1}</small></div><FighterHud name={p2Name} hp={hp[1]} wins={wins[1]} side="p2" fighterId={fighters[p2Choice].id}/></div>
      <div className={`arena arena-${arena} ${moves[1]==="hit"?"impact-shake":""}`}><div className="stage-depth"/><div className="moving-train"><i/><i/><i/><i/><i/></div><div className="arena-name">FASE {stage+1}/5 • ESTAÇÃO {stages[stage].name.toUpperCase()}</div><div className={`fighter player ${moves[0]}`} style={{left:`${position[0]}%`,bottom:`${verticalPosition[0]}%`}}><div className={`sprite fighter-${fighters[p1Choice].id}`}/><span>{p1Name}</span></div><div className={`fighter cpu ${moves[1]}`} style={{left:`${position[1]}%`,bottom:`${verticalPosition[1]}%`}}><div className={`sprite fighter-${fighters[p2Choice].id}`}/><span>{p2Name}</span></div>{(moves[0]==="punch"||moves[0]==="kick"||moves[0]==="special")&&<div className={`hit-spark spark-${moves[0]}`}/>}<div className="fight-message">{message}</div>{combo>=2&&<div className="combo-badge">{combo}<small>HIT COMBO</small></div>}<div className="floor-glow"/></div>
      {stageTransition&&<div className="stage-transition"><span>NÍVEL CONCLUÍDO</span><div className="station-arrow">↑</div><small>INDO PARA O NÍVEL DA ESTAÇÃO</small><b>{stageTransition.toUpperCase()}</b><i>FASE {stage + 2} DE 5</i></div>}
      <div className="meters"><div className="energy-row"><b>P1 ESPECIAL</b><div className="energy"><i style={{width:`${energy[0]}%`}}/></div><span>{energy[0]}%</span></div><div className="energy-row reverse-meter"><b>P2 ESPECIAL</b><div className="energy"><i style={{width:`${energy[1]}%`}}/></div><span>{energy[1]}%</span></div></div>
      <button className="mobile-music" onClick={playMusic}>♫ MÚSICA</button>
      <div className="controls"><div className="dpad"><button aria-label="Mover para trás" onPointerDown={()=>holdDirection(()=>moveFighter(0,-1.6))}>◀</button><button aria-label="Mover para cima" onPointerDown={()=>holdDirection(()=>moveVertical(0,1.1))}>▲</button><button aria-label="Mover para frente" onPointerDown={()=>holdDirection(()=>moveFighter(0,1.6))}>▶</button><button aria-label="Mover para baixo" onPointerDown={()=>holdDirection(()=>moveVertical(0,-1.1))}>▼</button></div><div className="actions"><button className="block" onClick={()=>act(0,"block")}><small>◆</small>DEFESA</button><button className="punch" onClick={()=>act(0,"punch")}><small>●</small>SOCO</button><button className="kick" onClick={()=>act(0,"kick")}><small>●</small>CHUTE</button><button className="special" disabled={energy[0]<100} onClick={()=>act(0,"special")}><small>⚡</small>ESPECIAL</button></div></div>
    </section>}

    {screen === "over" && <section className="game-over"><p>{stage===4&&wins[0]>wins[1]?"CAMPANHA CONCLUÍDA":"FIM DA CAMPANHA"}</p><h2>{wins[0]>wins[1]?p1Name:p2Name} VENCEU!</h2><div className="final-score">FASE {stage+1}<span>/5</span></div><p className="match-data">Maior combo: {combo} • Estação: {stages[stage].name.toUpperCase()}</p><div><button className="ghost" onClick={()=>setScreen("setup")}>ALTERAR JOGO</button><button className="start" onClick={start}>JOGAR DE NOVO</button></div></section>}

    {showInstallHelp&&<div className="modal-backdrop" onClick={()=>setShowInstallHelp(false)}><div className="help-modal install-help" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowInstallHelp(false)}>×</button><p>INSTALAR BRÁS FIGHTERS</p><h2>{isIos?"NO IPHONE OU IPAD":"NO CELULAR"}</h2>{isIos?<div className="install-steps"><span><b>1</b>Toque no botão <strong>Compartilhar</strong> do Safari.</span><span><b>2</b>Escolha <strong>Adicionar à Tela de Início</strong>.</span><span><b>3</b>Confirme em <strong>Adicionar</strong>.</span></div>:<div className="install-steps"><span><b>1</b>Abra o menu do navegador.</span><span><b>2</b>Escolha <strong>Instalar aplicativo</strong>.</span><span><b>3</b>Confirme a instalação.</span></div>}<button className="start" onClick={()=>setShowInstallHelp(false)}>ENTENDI</button></div></div>}
    {showHelp&&<div className="modal-backdrop" onClick={()=>setShowHelp(false)}><div className="help-modal" onClick={e=>e.stopPropagation()}><button className="close" onClick={()=>setShowHelp(false)}>×</button><p>TUTORIAL RÁPIDO</p><h2>COMO JOGAR</h2><div className="mobile-help"><div><b>◀ ▲ ▶</b><span>Movimente e pule usando os botões da esquerda.</span></div><div><b>SOCO • CHUTE</b><span>Use os botões da direita para atacar.</span></div><div><b>DEFESA</b><span>Segure o golpe do adversário.</span></div><div><b>ESPECIAL</b><span>Libera quando a barra chegar a 100%.</span></div></div><p className="tip">Acerte golpes seguidos para criar combos e causar mais pressão.</p><button className="start" onClick={()=>setShowHelp(false)}>ENTENDI!</button></div></div>}
    
  </main>;
}

function FighterHud({name,hp,wins,side,fighterId}:{name:string;hp:number;wins:number;side:"p1"|"p2";fighterId:string}) {
  return <div className={`fighter-info ${side==="p2"?"reverse":""}`}><div className={`portrait ${side}`} style={{backgroundImage:`url('/fighter-${fighterId}.png')`}}/><div className="bar-wrap"><b>{name}</b><div className="health"><i className={hp<30?"danger":""} style={{width:`${hp}%`}}/></div><div className="rounds">{[0,1].map(i=><span key={i} className={i<wins?"won":""}/>)}</div></div></div>;
}
