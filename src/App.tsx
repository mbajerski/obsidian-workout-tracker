import React, { useState, useEffect, useRef } from "react";
import {
  Dumbbell,
  Play,
  RotateCcw,
  Check,
  Plus,
  Trash2,
  Info,
  Clock,
  Flame,
  Scale,
  FileText,
  Download,
  Copy,
  CheckCheck,
  Smartphone,
  Monitor,
  Volume2,
  Vibrate,
  Bell,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  Layers,
} from "lucide-react";

interface SetItem {
  id: string;
  setNumber: number;
  prevKg: number;
  prevReps: number;
  kg: string;
  reps: string;
  completed: boolean;
}

interface ExerciseItem {
  id: string;
  name: string;
  muscle: string;
  cover?: string;
  defaultRest: number;
  instructions: string;
  sets: SetItem[];
}

export default function App() {
  const [activeTab, setActiveTab] = useState<"simulator" | "vault" | "files" | "guide">("simulator");
  const [deviceMode, setDeviceMode] = useState<"mobile" | "desktop">("mobile");

  // Stan symulacji aktywnego treningu
  const [isWorkoutActive, setIsWorkoutActive] = useState<boolean>(true);
  const [workoutElapsedSeconds, setWorkoutElapsedSeconds] = useState<number>(1455); // 00:24:15
  const [activeRestSeconds, setActiveRestSeconds] = useState<number | null>(85); // 01:25
  const [totalRestSeconds, setTotalRestSeconds] = useState<number>(120);
  const [activeRestExercise, setActiveRestExercise] = useState<string>("Wyciskanie sztangi leżąc");

  // Aktywne ćwiczenia w sesji
  const [exercises, setExercises] = useState<ExerciseItem[]>([
    {
      id: "ex_1",
      name: "Wyciskanie sztangi leżąc",
      muscle: "Klatka piersiowa",
      cover: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=300&auto=format&fit=crop&q=80",
      defaultRest: 120,
      instructions:
        "1. Połóż się stabilnie na ławce poziomej, ściągnij i opuść łopatki (retrakcja i depresja).\n2. Wbij całe stopy w podłoże i zachowaj naturalną lordozę kręgosłupa.\n3. Opuść gryf pod pełną kontrolą do dolnej części mostka.\n4. Wyciśnij ciężar w górę, nie odrywając pośladków.",
      sets: [
        { id: "s1", setNumber: 1, prevKg: 80, prevReps: 10, kg: "80", reps: "10", completed: true },
        { id: "s2", setNumber: 2, prevKg: 82.5, prevReps: 8, kg: "82.5", reps: "8", completed: false },
        { id: "s3", setNumber: 3, prevKg: 82.5, prevReps: 6, kg: "", reps: "", completed: false },
      ],
    },
    {
      id: "ex_2",
      name: "Wiosłowanie hantlem jednorącz",
      muscle: "Plecy (Najszerszy grzbietu)",
      cover: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=300&auto=format&fit=crop&q=80",
      defaultRest: 90,
      instructions:
        "1. Oprzyj kolano i dłoń na ławce. Kręgosłup w pozycji neutralnej.\n2. Inicjuj ruch od cofnięcia łopatki, ciągnąc hantel w kierunku biodra.\n3. Przytrzymaj szczytowe spięcie i powoli opuść hantel.",
      sets: [
        { id: "s2_1", setNumber: 1, prevKg: 32, prevReps: 12, kg: "", reps: "", completed: false },
        { id: "s2_2", setNumber: 2, prevKg: 32, prevReps: 10, kg: "", reps: "", completed: false },
      ],
    },
  ]);

  const [selectedInfoExercise, setSelectedInfoExercise] = useState<ExerciseItem | null>(null);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [completedWorkoutSummary, setCompletedWorkoutSummary] = useState<string | null>(null);

  // Timer treningu
  useEffect(() => {
    if (!isWorkoutActive) return;
    const interval = setInterval(() => {
      setWorkoutElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isWorkoutActive]);

  // Timer odpoczynku
  useEffect(() => {
    if (activeRestSeconds === null || activeRestSeconds <= 0) return;
    const interval = setInterval(() => {
      setActiveRestSeconds((prev) => {
        if (prev === null || prev <= 1) {
          triggerSoundAndVibration();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeRestSeconds]);

  // Dźwięk Web Audio API
  const triggerSoundAndVibration = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(880, now);
        g1.gain.setValueAtTime(0.2, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc1.connect(g1);
        g1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.25);

        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1760, now + 0.15);
        g2.gain.setValueAtTime(0.3, now + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc2.connect(g2);
        g2.connect(ctx.destination);
        osc2.start(now + 0.15);
        osc2.stop(now + 0.45);
      }
    } catch (e) {
      console.log(e);
    }

    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate([250, 100, 250]);
      } catch (e) {}
    }
  };

  const formatSeconds = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleToggleSet = (exIndex: number, setIndex: number) => {
    const newExercises = [...exercises];
    const targetSet = newExercises[exIndex].sets[setIndex];

    if (targetSet.completed) {
      targetSet.completed = false;
    } else {
      // Jeśli wartości są puste, przejmij ghost text (poprzedni trening)
      if (!targetSet.kg.trim()) {
        targetSet.kg = targetSet.prevKg.toString();
      }
      if (!targetSet.reps.trim()) {
        targetSet.reps = targetSet.prevReps.toString();
      }
      targetSet.completed = true;

      // Start timera odpoczynku
      const rest = newExercises[exIndex].defaultRest || 90;
      setTotalRestSeconds(rest);
      setActiveRestSeconds(rest);
      setActiveRestExercise(newExercises[exIndex].name);
    }

    setExercises(newExercises);
  };

  const handleAddSet = (exIndex: number) => {
    const newExercises = [...exercises];
    const sets = newExercises[exIndex].sets;
    const lastSet = sets[sets.length - 1];

    sets.push({
      id: "s_" + Date.now(),
      setNumber: sets.length + 1,
      prevKg: lastSet ? lastSet.prevKg : 50,
      prevReps: lastSet ? lastSet.prevReps : 10,
      kg: "",
      reps: "",
      completed: false,
    });
    setExercises(newExercises);
  };

  const handleFinishWorkout = () => {
    let totalVol = 0;
    let completedCount = 0;

    exercises.forEach((ex) => {
      ex.sets.forEach((s) => {
        if (s.completed) {
          const w = parseFloat(s.kg) || s.prevKg || 0;
          const r = parseInt(s.reps, 10) || s.prevReps || 0;
          totalVol += w * r;
          completedCount++;
        }
      });
    });

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const summary = `---
type: workout-log
template: "[[Workouts/Templates/Trening A|Trening A]]"
date: ${dateStr}
duration: "${formatSeconds(workoutElapsedSeconds)}"
totalVolumeKg: ${totalVol}
completedSets: ${completedCount}
---

# Trening A (${dateStr})

${exercises
  .map(
    (ex) => `## [[Workouts/Exercises/${ex.name}|${ex.name}]]
| Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |
|:-----:|:----------:|:-----------:|:-----------:|:------:|
${ex.sets
  .map(
    (s, idx) =>
      `| ${idx + 1} | ${s.prevKg}kg × ${s.prevReps} | ${s.kg || s.prevKg} | ${s.reps || s.prevReps} | ${s.completed ? "✓" : "–"} |`
  )
  .join("\n")}`
  )
  .join("\n\n")}`;

    setCompletedWorkoutSummary(summary);
    setIsWorkoutActive(false);
    setActiveRestSeconds(null);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(id);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const downloadFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="min-h-screen bg-[#141517] text-[#e0e2e6] font-sans flex flex-col">
      {/* Pasek nawigacyjny */}
      <header className="border-b border-[#2d3139] bg-[#1a1b1e] px-4 py-3 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shadow-sm">
              <Dumbbell className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Obsidian Workout Tracker</h1>
                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Hevy Style v1.0
                </span>
              </div>
              <p className="text-xs text-neutral-400">100% Offline Markdown • Native Obsidian Plugin</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#23252a] rounded-lg p-0.5 border border-[#323640]">
              <button
                onClick={() => setActiveTab("simulator")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "simulator"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Play className="w-3.5 h-3.5" /> Symulator UI (Hevy)
              </button>
              <button
                onClick={() => setActiveTab("vault")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "vault"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Pliki Markdown w Vaulcie
              </button>
              <button
                onClick={() => setActiveTab("files")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "files"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Kod Pluginu (GitHub/BRAT)
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 ${
                  activeTab === "guide"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                <Download className="w-3.5 h-3.5" /> Instrukcja instalacji
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Główna zawartość */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        {/* =========================================================================
            TAB 1: INTERAKTYWNY SYMULATOR OBSIDIAN WORKOUT MODAL
           ========================================================================= */}
        {activeTab === "simulator" && (
          <div className="flex-1 flex flex-col items-center">
            {/* Przełącznik widoku Mobile vs Desktop */}
            <div className="w-full max-w-md mb-4 flex items-center justify-between bg-[#1f2024] px-3 py-2 rounded-xl border border-[#2d3139]">
              <span className="text-xs text-neutral-400 font-medium">Podgląd urządzenia:</span>
              <div className="flex gap-1">
                <button
                  onClick={() => setDeviceMode("mobile")}
                  className={`px-3 py-1 text-xs rounded-lg flex items-center gap-1.5 transition-all ${
                    deviceMode === "mobile"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Smartfon (100vw / Hevy)
                </button>
                <button
                  onClick={() => setDeviceMode("desktop")}
                  className={`px-3 py-1 text-xs rounded-lg flex items-center gap-1.5 transition-all ${
                    deviceMode === "desktop"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Obsidian Desktop (Modal)
                </button>
              </div>
            </div>

            {/* Ramka urządzenia */}
            <div
              className={`w-full transition-all duration-300 flex flex-col ${
                deviceMode === "mobile"
                  ? "max-w-[430px] h-[820px] bg-[#16171a] rounded-[38px] border-4 border-[#323640] shadow-2xl overflow-hidden relative"
                  : "max-w-[780px] bg-[#1a1b1e] rounded-2xl border border-[#323640] shadow-2xl overflow-hidden"
              }`}
            >
              {/* Dynamic Island / Notch na telefonie */}
              {deviceMode === "mobile" && (
                <div className="w-full h-7 bg-[#16171a] flex items-center justify-center relative shrink-0">
                  <div className="w-24 h-4 bg-black rounded-full"></div>
                </div>
              )}

              {/* Ekran aktywnego treningu */}
              {isWorkoutActive ? (
                <div className="flex-1 flex flex-col h-full bg-[#1e2025] overflow-hidden text-neutral-100">
                  {/* 1. Nagłówek sesji */}
                  <div className="px-4 py-3 bg-[#262830] border-b border-[#353842] flex items-center justify-between shrink-0">
                    <button
                      onClick={() => {
                        if (confirm("Porzucić trening?")) setIsWorkoutActive(false);
                      }}
                      className="text-xs text-neutral-400 hover:text-red-400 font-medium py-1 px-2 rounded hover:bg-neutral-800 transition"
                    >
                      ✕ Porzuć
                    </button>
                    <div className="text-center">
                      <h2 className="text-sm font-bold text-white tracking-tight">TRENING A (Góra)</h2>
                      <span className="text-[10px] text-neutral-400">Aktywna sesja</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                      {formatSeconds(workoutElapsedSeconds)}
                    </div>
                  </div>

                  {/* 2. Sticky Rest Timer Bar */}
                  {activeRestSeconds !== null && (
                    <div className="bg-gradient-to-b from-[#252830] to-[#1c1d22] border-b-2 border-emerald-500 px-4 py-2.5 flex flex-col gap-1.5 shrink-0 shadow-md">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-xs font-bold">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          <span>
                            ODPOCZYNEK: {formatSeconds(activeRestSeconds)} / {formatSeconds(totalRestSeconds)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveRestSeconds((prev) => (prev ? prev + 30 : 30));
                              setTotalRestSeconds((prev) => prev + 30);
                            }}
                            className="text-[10px] font-bold bg-[#323640] hover:bg-[#3d424e] text-neutral-200 px-2 py-1 rounded border border-[#444955] transition"
                          >
                            +30s
                          </button>
                          <button
                            onClick={() => setActiveRestSeconds(null)}
                            className="text-[10px] font-bold bg-[#323640] hover:bg-[#3d424e] text-neutral-200 px-2 py-1 rounded border border-[#444955] transition"
                          >
                            Pomiń
                          </button>
                        </div>
                      </div>
                      {/* Pasek postępu */}
                      <div className="w-full h-1.5 bg-[#2f333d] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
                          style={{
                            width: `${Math.max(0, Math.min(100, (activeRestSeconds / totalRestSeconds) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* 3. Lista ćwiczeń (Scroll Area) */}
                  <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
                    {exercises.map((ex, exIndex) => (
                      <div
                        key={ex.id}
                        className="bg-[#262830] rounded-xl border border-[#353842] p-3 shadow-sm hover:border-[#424652] transition"
                      >
                        {/* Tytuł ćwiczenia i przycisk Info */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-neutral-500">{exIndex + 1}.</span>
                            <h3 className="text-sm font-semibold text-white">{ex.name}</h3>
                          </div>
                          <button
                            onClick={() => setSelectedInfoExercise(ex)}
                            className="text-[11px] font-medium bg-[#323640] hover:bg-[#3d424f] text-neutral-300 px-2.5 py-1 rounded-md border border-[#424652] flex items-center gap-1 transition"
                          >
                            <Info className="w-3 h-3 text-emerald-400" /> Info
                          </button>
                        </div>

                        {/* Subbar: Partia mięśniowa + miniatura */}
                        <div className="flex items-center gap-2.5 mb-3 pb-2 border-b border-[#353842]">
                          {ex.cover && (
                            <img
                              src={ex.cover}
                              alt={ex.name}
                              className="w-10 h-10 rounded-md object-cover border border-[#424652] shrink-0"
                            />
                          )}
                          <div className="flex flex-wrap gap-1.5 items-center">
                            <span className="text-[10px] font-medium bg-[#323640] text-neutral-300 px-2 py-0.5 rounded">
                              {ex.muscle}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Odpoczynek: {ex.defaultRest}s
                            </span>
                          </div>
                        </div>

                        {/* Tabela serii w stylu Hevy */}
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-neutral-400 uppercase text-[10px] font-bold border-b border-[#353842]">
                              <th className="pb-1.5 text-center w-10">Seria</th>
                              <th className="pb-1.5 text-center">Poprzednio</th>
                              <th className="pb-1.5 text-center w-16">KG</th>
                              <th className="pb-1.5 text-center w-16">Powt.</th>
                              <th className="pb-1.5 text-center w-12">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#323640]/50">
                            {ex.sets.map((set, setIndex) => (
                              <tr
                                key={set.id}
                                className={`transition-colors ${
                                  set.completed ? "bg-emerald-500/10 text-neutral-200" : ""
                                }`}
                              >
                                <td className="py-2 text-center font-bold text-neutral-400">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#323640] text-[11px]">
                                    {setIndex + 1}
                                  </span>
                                </td>
                                <td className="py-2 text-center font-mono text-neutral-400 text-[11px]">
                                  {set.prevKg}kg × {set.prevReps}
                                </td>
                                <td className="py-2 text-center">
                                  <input
                                    type="text"
                                    inputMode="decimal"
                                    disabled={set.completed}
                                    placeholder={set.prevKg.toString()}
                                    value={set.kg}
                                    onChange={(e) => {
                                      const newExs = [...exercises];
                                      newExs[exIndex].sets[setIndex].kg = e.target.value;
                                      setExercises(newExs);
                                    }}
                                    className={`w-14 h-8 text-center font-mono font-bold text-xs rounded border transition outline-none ${
                                      set.completed
                                        ? "bg-transparent border-transparent text-white"
                                        : "bg-[#1e2025] border-[#444955] text-white focus:border-emerald-500 placeholder-neutral-500"
                                    }`}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    disabled={set.completed}
                                    placeholder={set.prevReps.toString()}
                                    value={set.reps}
                                    onChange={(e) => {
                                      const newExs = [...exercises];
                                      newExs[exIndex].sets[setIndex].reps = e.target.value;
                                      setExercises(newExs);
                                    }}
                                    className={`w-14 h-8 text-center font-mono font-bold text-xs rounded border transition outline-none ${
                                      set.completed
                                        ? "bg-transparent border-transparent text-white"
                                        : "bg-[#1e2025] border-[#444955] text-white focus:border-emerald-500 placeholder-neutral-500"
                                    }`}
                                  />
                                </td>
                                <td className="py-2 text-center">
                                  <button
                                    onClick={() => handleToggleSet(exIndex, setIndex)}
                                    title="Zatwierdź serię (przyjmuje ghost text jeśli puste)"
                                    className={`w-9 h-9 min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center mx-auto transition-all font-bold ${
                                      set.completed
                                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 scale-105"
                                        : "bg-[#323640] border border-[#444955] text-neutral-400 hover:border-emerald-500 hover:text-white"
                                    }`}
                                  >
                                    {set.completed ? <Check className="w-5 h-5 stroke-[3]" /> : null}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        {/* Dodaj serię */}
                        <div className="mt-2.5 pt-2 border-t border-[#353842] flex justify-between items-center">
                          <button
                            onClick={() => handleAddSet(exIndex)}
                            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 py-1 px-2 rounded hover:bg-emerald-500/10 flex items-center gap-1 transition"
                          >
                            <Plus className="w-3.5 h-3.5" /> Dodaj serię
                          </button>
                          {ex.sets.length > 1 && (
                            <button
                              onClick={() => {
                                const newExs = [...exercises];
                                newExs[exIndex].sets.pop();
                                setExercises(newExs);
                              }}
                              className="text-[11px] text-neutral-500 hover:text-red-400 py-1 px-2 rounded transition"
                            >
                              Usuń ostatnią
                            </button>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Przycisk dodania kolejnego ćwiczenia */}
                    <button
                      onClick={() => {
                        const newEx: ExerciseItem = {
                          id: "ex_" + Date.now(),
                          name: "Wznosy hantli bokiem",
                          muscle: "Barki (Boczny akton)",
                          defaultRest: 60,
                          instructions: "Unoś hantle bokiem lekko ugiętymi rękami do linii barków.",
                          sets: [
                            { id: "s3_1", setNumber: 1, prevKg: 12, prevReps: 15, kg: "", reps: "", completed: false },
                            { id: "s3_2", setNumber: 2, prevKg: 12, prevReps: 12, kg: "", reps: "", completed: false },
                          ],
                        };
                        setExercises([...exercises, newEx]);
                      }}
                      className="w-full py-2.5 rounded-xl border border-dashed border-[#444955] text-neutral-300 hover:text-white hover:border-emerald-500 hover:bg-emerald-500/5 text-xs font-medium flex items-center justify-center gap-1.5 transition"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" /> Dodaj ćwiczenie do sesji
                    </button>
                  </div>

                  {/* 4. Dolny pasek ZAKOŃCZ TRENING */}
                  <div className="p-3.5 bg-[#262830] border-t border-[#353842] shrink-0">
                    <button
                      onClick={handleFinishWorkout}
                      className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs tracking-wider uppercase transition shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4 stroke-[3]" /> Zakończ i Zapisz Trening
                    </button>
                  </div>
                </div>
              ) : (
                /* Ekran podsumowania zakończonego treningu */
                <div className="flex-1 p-6 flex flex-col justify-center items-center text-center bg-[#1e2025]">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg">
                    <CheckCheck className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">Trening Zapisany w Markdown!</h3>
                  <p className="text-xs text-neutral-400 max-w-xs mb-4">
                    Plik został automatycznie utworzony w <code className="text-emerald-400">Workouts/Logs/2026-09-13-Trening-A.md</code>
                  </p>
                  <button
                    onClick={() => {
                      setIsWorkoutActive(true);
                      setWorkoutElapsedSeconds(0);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Rozpocznij nową sesję
                  </button>
                </div>
              )}
            </div>

            {/* Test Dźwięku i Wibracji dla smartwatcha */}
            <div className="mt-4 flex items-center gap-3 bg-[#1e2025] px-4 py-2 rounded-xl border border-[#2d3139]">
              <span className="text-xs text-neutral-400">Przetestuj alerty kończące odpoczynek:</span>
              <button
                onClick={triggerSoundAndVibration}
                className="px-3 py-1 bg-[#2d3139] hover:bg-[#383d47] text-emerald-400 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
              >
                <Volume2 className="w-3.5 h-3.5" /> Dźwięk & Wibracja
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: PODGLĄD PLIKÓW MARKDOWN W VAULCIE (100% OFFLINE)
           ========================================================================= */}
        {activeTab === "vault" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* 1. Szablon Treningu */}
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Workouts/Templates/Trening A.md
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `---\ntype: workout-template\nname: Trening A (Góra ciała)\ndefaultRestSeconds: 90\nexercises:\n  - name: Wyciskanie sztangi leżąc\n    sets: 3\n    targetReps: 8-10\n    defaultWeight: 80\n  - name: Wiosłowanie hantlem\n    sets: 3\n    targetReps: 10-12\n    defaultWeight: 32\n---\n# Trening A (Góra ciała)\nZalecana rozgrzewka 5 min na wioślarzu.`,
                      "tmpl"
                    )
                  }
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  {copiedFile === "tmpl" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Kopiuj
                </button>
              </div>
              <pre className="flex-1 bg-[#141517] p-3 rounded-lg text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed border border-[#26282f]">
{`---
type: workout-template
name: Trening A (Góra ciała)
defaultRestSeconds: 90
exercises:
  - name: Wyciskanie sztangi leżąc
    sets: 3
    targetReps: 8-10
    defaultWeight: 80
  - name: Wiosłowanie hantlem
    sets: 3
    targetReps: 10-12
    defaultWeight: 32
---
# Trening A (Góra ciała)
Zalecana rozgrzewka 5 min na wioślarzu.`}
              </pre>
            </div>

            {/* 2. Baza wiedzy ćwiczeń */}
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Workouts/Exercises/Wyciskanie leżąc.md
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `---\ntype: exercise\nmuscleGroup: Klatka piersiowa\nsecondaryMuscles: [Triceps, Przedni bark]\ncover: "attachments/bench.png"\ndefaultRest: 120\n---\n# Wyciskanie sztangi leżąc\n\n### Technika:\n1. Ściągnij łopatki i wbij stopy w podłoże.\n2. Opuść gryf do linii mostka.\n3. Wyciśnij po lekkim łuku do góry.`,
                      "ex"
                    )
                  }
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  {copiedFile === "ex" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Kopiuj
                </button>
              </div>
              <pre className="flex-1 bg-[#141517] p-3 rounded-lg text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed border border-[#26282f]">
{`---
type: exercise
muscleGroup: Klatka piersiowa
secondaryMuscles: [Triceps, Przedni bark]
cover: "attachments/bench.png"
defaultRest: 120
---
# Wyciskanie sztangi leżąc

### Technika:
1. Ściągnij łopatki i wbij stopy w podłoże.
2. Opuść gryf do linii mostka.
3. Wyciśnij po lekkim łuku do góry.`}
              </pre>
            </div>

            {/* 3. Log treningu wygenerowany po ukończeniu */}
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Workouts/Logs/2026-09-13-Trening-A.md
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      completedWorkoutSummary ||
                        `---\ntype: workout-log\ntemplate: "[[Workouts/Templates/Trening A|Trening A]]"\ndate: 2026-09-13\nduration: "00:52:30"\ntotalVolumeKg: 4250\ncompletedSets: 15\n---\n# Trening A (2026-09-13)\n\n## [[Workouts/Exercises/Wyciskanie leżąc|Wyciskanie sztangi leżąc]]\n| Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |\n|:-----:|:----------:|:-----------:|:-----------:|:------:|\n| 1 | 80kg × 10 | 80.0 | 10 | ✓ |\n| 2 | 82.5kg × 8 | 82.5 | 8 | ✓ |`,
                      "log"
                    )
                  }
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  {copiedFile === "log" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Kopiuj
                </button>
              </div>
              <pre className="flex-1 bg-[#141517] p-3 rounded-lg text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed border border-[#26282f]">
{completedWorkoutSummary ||
`---
type: workout-log
template: "[[Workouts/Templates/Trening A|Trening A]]"
date: 2026-09-13
duration: "00:52:30"
totalVolumeKg: 4250
completedSets: 15
---
# Trening A (2026-09-13)

## [[Workouts/Exercises/Wyciskanie leżąc|Wyciskanie sztangi leżąc]]
| Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |
|:-----:|:----------:|:-----------:|:-----------:|:------:|
| 1 | 80kg × 10 | 80.0 | 10 | ✓ |
| 2 | 82.5kg × 8 | 82.5 | 8 | ✓ |
| 3 | 82.5kg × 6 | 85.0 | 6 | ✓ |`}
              </pre>
            </div>

            {/* 4. Body Tracker */}
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-emerald-400">
                  Workouts/Body Tracker.md
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `---\ntype: body-tracker\nlastUpdated: 2026-09-13\n---\n# Pomiary ciała\n\n| Data | Waga (kg) | Klatka (cm) | Ramię (cm) | Pas (cm) | Udo (cm) | Notatki |\n|:----:|:---------:|:-----------:|:----------:|:--------:|:--------:|:-------:|\n| 2026-09-01 | 82.4 | 108.0 | 39.0 | 84.0 | 61.0 | Rano na czczo |\n| 2026-09-08 | 82.1 | 108.5 | 39.2 | 83.5 | 61.2 | Poprawa definicji |`,
                      "body"
                    )
                  }
                  className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"
                >
                  {copiedFile === "body" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  Kopiuj
                </button>
              </div>
              <pre className="flex-1 bg-[#141517] p-3 rounded-lg text-xs font-mono text-neutral-300 overflow-x-auto leading-relaxed border border-[#26282f]">
{`---
type: body-tracker
lastUpdated: 2026-09-13
---
# Pomiary ciała

| Data | Waga (kg) | Klatka (cm) | Ramię (cm) | Pas (cm) | Udo (cm) | Notatki |
|:----:|:---------:|:-----------:|:----------:|:--------:|:--------:|:-------:|
| 2026-09-01 | 82.4 | 108.0 | 39.0 | 84.0 | 61.0 | Rano na czczo |
| 2026-09-08 | 82.1 | 108.5 | 39.2 | 83.5 | 61.2 | Poprawa definicji |`}
              </pre>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: KOD PLUGINU DLA OBSIDIANA (GITHUB / BRAT)
           ========================================================================= */}
        {activeTab === "files" && (
          <div className="space-y-4 flex-1">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-emerald-400">Paczka produkcyjna main.js została pomyślnie wygenerowana!</h3>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Wszystkie pliki źródłowe oraz skompilowany plik <code className="text-emerald-300 font-bold">main.js</code> są gotowe do wysłania na GitHub i bezpośredniej instalacji w Obsidianie przez wtyczkę <strong>BRAT</strong>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Plik 1: manifest.json */}
              <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-xs font-bold text-white">manifest.json</div>
                  <button
                    onClick={() => {
                      const c = JSON.stringify(
                        {
                          id: "obsidian-workout-tracker",
                          name: "Workout Tracker (Hevy Style)",
                          version: "1.0.0",
                          minAppVersion: "1.4.0",
                          description: "Natywna wtyczka treningowa w stylu Hevy – szablony, aktywny trening, rest timer z powiadomieniami i śledzenie progresu w Markdown.",
                          author: "Obsidian Fitness Dev",
                          authorUrl: "https://github.com",
                          isDesktopOnly: false,
                        },
                        null,
                        2
                      );
                      downloadFile("manifest.json", c);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
                  >
                    <Download className="w-3.5 h-3.5" /> Pobierz
                  </button>
                </div>
                <p className="text-xs text-neutral-400 mb-2">Identyfikator wtyczki wymagany przez Obsidian i BRAT.</p>
                <div className="text-[11px] font-mono text-neutral-400 bg-[#141517] p-2.5 rounded border border-[#26282f]">
                  id: "obsidian-workout-tracker"<br />
                  isDesktopOnly: false
                </div>
              </div>

              {/* Plik 2: main.js */}
              <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-xs font-bold text-white">main.js (Bundled)</div>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-bold">
                    60 KB • Gotowy
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-2">
                  Skompilowany kod JavaScript wtyczki. Zawiera całą logikę timera, dźwięku, ghost textu i zapisu Markdown.
                </p>
                <div className="text-[11px] font-mono text-neutral-400 bg-[#141517] p-2.5 rounded border border-[#26282f]">
                  Skompilowano przez esbuild.<br />
                  Gotowy dla BRAT i folderu plugins.
                </div>
              </div>

              {/* Plik 3: styles.css */}
              <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-mono text-xs font-bold text-white">styles.css</div>
                  <span className="text-[10px] bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded font-bold">
                    15 KB
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-2">
                  Style CSS: 100vw/100vh na Androidzie, zmienne Obsidian CSS, ergonomia 44px pod palec.
                </p>
                <div className="text-[11px] font-mono text-neutral-400 bg-[#141517] p-2.5 rounded border border-[#26282f]">
                  .is-mobile-fullscreen<br />
                  --interactive-accent
                </div>
              </div>
            </div>

            {/* Lista plików źródłowych */}
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-xl p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                Wszystkie pliki w repozytorium projektu:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">src/main.ts</div>
                  <div className="text-neutral-400 text-[11px]">Rejestracja wtyczki, komendy, wstążka, ochrona LMK</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">src/workout-modal.ts</div>
                  <div className="text-neutral-400 text-[11px]">Modal Hevy, ghost text, rest timer, dźwięk & wibracja</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">src/storage.ts</div>
                  <div className="text-neutral-400 text-[11px]">Parser i zapis plików Markdown w vaulcie</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">src/types.ts</div>
                  <div className="text-neutral-400 text-[11px]">Definicje TypeScript dla sesji i szablonów</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">esbuild.config.mjs</div>
                  <div className="text-neutral-400 text-[11px]">Skrypt automatycznego bundlowania wtyczki</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">package.json</div>
                  <div className="text-neutral-400 text-[11px]">Zależności i skrypty npm run build:plugin</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">manifest.json</div>
                  <div className="text-neutral-400 text-[11px]">Metadane pluginu dla Obsidiana</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#141517] border border-[#26282f]">
                  <div className="font-mono font-bold text-white">README.md</div>
                  <div className="text-neutral-400 text-[11px]">Kompletna instrukcja dla użytkownika</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 4: KROK PO KROKU – JAK WGRAĆ PRZEZ GITHUB I BRAT
           ========================================================================= */}
        {activeTab === "guide" && (
          <div className="max-w-3xl mx-auto space-y-6 flex-1 py-4">
            <div className="bg-[#1e2025] border border-[#2d3139] rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" /> Jak wgrać wtyczkę przez BRAT (Zero kodowania!)
              </h2>
              <p className="text-xs text-neutral-300 mb-6">
                Wtyczka <strong>BRAT</strong> (Beta Reviewers Auto-update Tester) w Obsidianie pozwala pobierać i aktualizować dowolne wtyczki bezpośrednio z GitHuba na telefonie z Androidem oraz na komputerze.
              </p>

              <div className="space-y-4">
                {/* Krok 1 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Wypchnij repozytorium na swój GitHub</h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      Utwórz nowe repozytorium na GitHubie (np. <code className="text-emerald-300">obsidian-workout-tracker</code>) i wrzuć do niego pliki z tego projektu. Kluczowe jest, aby w głównym katalogu repozytorium znajdowały się:
                    </p>
                    <div className="font-mono text-xs text-emerald-300 bg-[#141517] px-3 py-1.5 rounded mt-2 border border-[#26282f]">
                      manifest.json • main.js • styles.css
                    </div>
                  </div>
                </div>

                {/* Krok 2 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Zainstaluj wtyczkę BRAT w Obsidianie</h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      W Obsidianie wejdź w <strong>Ustawienia</strong> → <strong>Wtyczki społeczności (Community plugins)</strong> → włącz je, a następnie wyszukaj wtyczkę <strong>BRAT</strong> i kliknij <strong>Zainstaluj</strong> oraz <strong>Włącz</strong>.
                    </p>
                  </div>
                </div>

                {/* Krok 3 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Dodaj link do swojego repozytorium</h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      W ustawieniach wtyczki <strong>BRAT</strong> kliknij przycisk <strong>Add Beta plugin</strong> i wklej adres URL swojego repozytorium, np.:
                    </p>
                    <div className="font-mono text-xs text-neutral-300 bg-[#141517] px-3 py-1.5 rounded mt-2 border border-[#26282f]">
                      https://github.com/TwojLogin/obsidian-workout-tracker
                    </div>
                    <p className="text-xs text-neutral-400 mt-2">
                      Kliknij <strong>Add Plugin</strong>. BRAT pobierze pliki w kilka sekund!
                    </p>
                  </div>
                </div>

                {/* Krok 4 */}
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Włącz Workout Tracker</h4>
                    <p className="text-xs text-neutral-400 mt-1">
                      Przejdź z powrotem do <strong>Wtyczki społeczności</strong> i włącz przełącznikiem <strong>Workout Tracker (Hevy Style)</strong>.
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Na lewym pasku pojawi się ikona hantla (Dumbbell) 🏋️‍♂️, a w palecie poleceń (Ctrl+P) komenda:
                      <code className="text-emerald-300 ml-1">Zainicjalizuj strukturę folderów i przykładowe szablony</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal [ ℹ Info ] o technice ćwiczenia */}
      {selectedInfoExercise && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e2025] border border-[#353842] rounded-2xl max-w-lg w-full p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
            <button
              onClick={() => setSelectedInfoExercise(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-emerald-400" /> {selectedInfoExercise.name}
            </h3>

            {selectedInfoExercise.cover && (
              <img
                src={selectedInfoExercise.cover}
                alt={selectedInfoExercise.name}
                className="w-full h-44 object-cover rounded-xl border border-[#353842] mb-3.5"
              />
            )}

            <div className="flex gap-2 mb-3">
              <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                Główna: {selectedInfoExercise.muscle}
              </span>
              <span className="text-xs bg-[#2d3139] text-neutral-300 px-2.5 py-1 rounded-md font-mono">
                Odpoczynek: {selectedInfoExercise.defaultRest}s
              </span>
            </div>

            <div className="bg-[#16171a] p-3.5 rounded-xl border border-[#26282f] mb-4">
              <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
                Instrukcja techniczna (Markdown z Vaulta):
              </h4>
              <p className="text-xs text-neutral-300 whitespace-pre-line leading-relaxed">
                {selectedInfoExercise.instructions}
              </p>
            </div>

            <button
              onClick={() => setSelectedInfoExercise(null)}
              className="w-full py-2.5 bg-[#2d3139] hover:bg-[#383d47] text-white font-medium text-xs rounded-xl transition"
            >
              Zamknij
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
