import { App, Modal, Notice, Platform, setIcon } from "obsidian";
import WorkoutTrackerPlugin from "./main";
import { WorkoutStorage } from "./storage";
import {
  ActiveWorkout,
  ExerciseMeta,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
} from "./types";

export class ActiveWorkoutModal extends Modal {
  plugin: WorkoutTrackerPlugin;
  storage: WorkoutStorage;
  workout: ActiveWorkout;
  exerciseMap: Map<string, ExerciseMeta> = new Map();

  // Timery
  private workoutInterval: number | null = null;
  private restInterval: number | null = null;
  private audioCtx: AudioContext | null = null;

  // Elementy DOM
  private headerDurationEl!: HTMLElement;
  private restTimerContainerEl!: HTMLElement;
  private restTimerProgressEl!: HTMLElement;
  private restTimerLabelEl!: HTMLElement;
  private exercisesContainerEl!: HTMLElement;

  constructor(
    app: App,
    plugin: WorkoutTrackerPlugin,
    workout: ActiveWorkout
  ) {
    super(app);
    this.plugin = plugin;
    this.storage = plugin.storage;
    this.workout = workout;
  }

  async onOpen() {
    const { contentEl, modalEl } = this;
    contentEl.empty();
    contentEl.addClass("workout-tracker-modal-content");
    modalEl.addClass("workout-tracker-modal-root");

    // Jeśli uruchomione na telefonie (Android / iOS)
    if (Platform.isMobile) {
      modalEl.addClass("is-mobile-fullscreen");
      document.body.addClass("workout-active-fullscreen-mode");
    }

    // Wczytaj metadane ćwiczeń (okładki, technika itp.)
    this.exerciseMap = await this.storage.loadExercises(this.plugin.settings);

    // Zażądaj uprawnień do powiadomień systemowych (potrzebne dla Android WebView i smartwatcha)
    this.requestNotificationPermission();

    // Inicjalizacja widoku
    this.renderHeader(contentEl);
    this.renderRestTimerBar(contentEl);

    // Kontener listy ćwiczeń
    this.exercisesContainerEl = contentEl.createDiv({
      cls: "workout-exercises-scroll-area",
    });
    this.renderAllExercises();

    // Dolny pasek akcji
    this.renderBottomBar(contentEl);

    // Uruchomienie licznika czasu trwania treningu
    this.startWorkoutTimer();

    // Wznowienie timera odpoczynku, jeśli istniał przed przeładowaniem
    if (this.workout.activeRestTimer) {
      this.resumeRestTimer();
    }
  }

  onClose() {
    this.stopWorkoutTimer();
    this.stopRestTimer(false);

    if (Platform.isMobile) {
      document.body.removeClass("workout-active-fullscreen-mode");
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {
        // Ignoruj
      }
    }

    this.contentEl.empty();
  }

  /**
   * Pasek nagłówka: Przycisk wyjścia, Tytuł sesji, Czas trwania
   */
  private renderHeader(container: HTMLElement) {
    const header = container.createDiv({ cls: "workout-modal-header" });

    const leftBtn = header.createEl("button", {
      cls: "workout-btn-ghost workout-btn-exit",
      text: "✕ Porzuć",
    });
    leftBtn.onclick = () => {
      this.promptCancelWorkout();
    };

    const titleEl = header.createEl("h2", {
      cls: "workout-modal-title",
      text: this.workout.templateName || "Trening",
    });

    this.headerDurationEl = header.createDiv({
      cls: "workout-duration-badge",
      text: this.formatDuration(Date.now() - this.workout.startTime),
    });
  }

  /**
   * Pasek odliczania odpoczynku (Sticky u góry)
   */
  private renderRestTimerBar(container: HTMLElement) {
    this.restTimerContainerEl = container.createDiv({
      cls: "workout-rest-timer-bar is-hidden",
    });

    const infoRow = this.restTimerContainerEl.createDiv({
      cls: "workout-rest-timer-info-row",
    });

    this.restTimerLabelEl = infoRow.createSpan({
      cls: "workout-rest-timer-label",
      text: "⏱ ODPOCZYNEK: 00:00 / 00:00",
    });

    const controls = infoRow.createDiv({ cls: "workout-rest-timer-controls" });

    const add30Btn = controls.createEl("button", {
      cls: "workout-btn-xs workout-btn-secondary",
      text: "+30s",
    });
    add30Btn.onclick = () => this.adjustRestTimer(30);

    const skipBtn = controls.createEl("button", {
      cls: "workout-btn-xs workout-btn-secondary",
      text: "Pomiń",
    });
    skipBtn.onclick = () => this.stopRestTimer(true);

    const progressBarWrapper = this.restTimerContainerEl.createDiv({
      cls: "workout-rest-progress-wrapper",
    });
    this.restTimerProgressEl = progressBarWrapper.createDiv({
      cls: "workout-rest-progress-fill",
    });
  }

  /**
   * Renderuje wszystkie ćwiczenia w sesji
   */
  private renderAllExercises() {
    this.exercisesContainerEl.empty();

    if (this.workout.exercises.length === 0) {
      const emptyNotice = this.exercisesContainerEl.createDiv({
        cls: "workout-empty-state",
      });
      emptyNotice.createEl("p", {
        text: "Brak ćwiczeń w tej sesji. Kliknij poniżej, aby dodać pierwsze ćwiczenie!",
      });
      return;
    }

    this.workout.exercises.forEach((ex, exIndex) => {
      this.renderExerciseCard(ex, exIndex);
    });
  }

  /**
   * Renderuje kartę pojedynczego ćwiczenia z tabelą serii
   */
  private renderExerciseCard(ex: WorkoutExercise, exIndex: number) {
    const card = this.exercisesContainerEl.createDiv({
      cls: "workout-exercise-card",
    });
    card.dataset.exerciseId = ex.id;

    // Nagłówek ćwiczenia
    const cardHeader = card.createDiv({ cls: "workout-exercise-header" });

    const titleWrap = cardHeader.createDiv({ cls: "workout-exercise-title-wrap" });
    const orderNum = titleWrap.createSpan({
      cls: "workout-exercise-index",
      text: `${exIndex + 1}.`,
    });
    const nameEl = titleWrap.createEl("h3", {
      cls: "workout-exercise-name",
      text: ex.exerciseName,
    });

    // Przycisk [ ℹ Info ] podglądu techniki
    const infoBtn = cardHeader.createEl("button", {
      cls: "workout-btn-info",
      text: "ℹ Info",
    });
    infoBtn.onclick = () => {
      const meta = this.exerciseMap.get(ex.exerciseName.toLowerCase());
      new ExerciseInfoModal(this.app, ex.exerciseName, meta).open();
    };

    // Subheader: Partia mięśniowa + miniatura (jeśli istnieje)
    const meta = this.exerciseMap.get(ex.exerciseName.toLowerCase());
    const subheader = card.createDiv({ cls: "workout-exercise-subbar" });

    if (meta?.cover) {
      const imgEl = subheader.createEl("img", {
        cls: "workout-exercise-thumbnail",
      });
      imgEl.src = this.resolveAttachmentPath(meta.cover);
      imgEl.alt = ex.exerciseName;
      imgEl.onerror = () => {
        imgEl.style.display = "none";
      };
    }

    const tagsWrap = subheader.createDiv({ cls: "workout-tags-wrap" });
    if (meta?.muscleGroup) {
      tagsWrap.createSpan({
        cls: "workout-muscle-tag",
        text: meta.muscleGroup,
      });
    }
    tagsWrap.createSpan({
      cls: "workout-rest-tag",
      text: `Odpoczynek: ${ex.defaultRestSeconds}s`,
    });

    // Tabela serii
    const table = card.createEl("table", { cls: "workout-sets-table" });

    // Nagłówek tabeli
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    headerRow.createEl("th", { text: "SERIA", cls: "col-set" });
    headerRow.createEl("th", { text: "POPRZEDNIO", cls: "col-prev" });
    headerRow.createEl("th", { text: "KG", cls: "col-weight" });
    headerRow.createEl("th", { text: "POWT.", cls: "col-reps" });
    headerRow.createEl("th", { text: "STATUS", cls: "col-status" });

    const tbody = table.createEl("tbody");

    ex.sets.forEach((set, setIndex) => {
      this.renderSetRow(tbody, ex, set, setIndex);
    });

    // Przyciski pod tabelą: Dodaj serię / Usuń serię
    const tableActions = card.createDiv({ cls: "workout-exercise-actions" });

    const addSetBtn = tableActions.createEl("button", {
      cls: "workout-btn-sm workout-btn-secondary",
      text: "+ Dodaj serię",
    });
    addSetBtn.onclick = () => {
      const lastSet = ex.sets[ex.sets.length - 1];
      const newSet: WorkoutSet = {
        id: "set_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        setNumber: ex.sets.length + 1,
        previousKg: lastSet?.previousKg,
        previousReps: lastSet?.previousReps,
        kg: null,
        reps: null,
        completed: false,
      };
      ex.sets.push(newSet);
      this.renderSetRow(tbody, ex, newSet, ex.sets.length - 1);
      this.persistActiveSession();
    };

    if (ex.sets.length > 1) {
      const removeSetBtn = tableActions.createEl("button", {
        cls: "workout-btn-sm workout-btn-ghost workout-btn-danger",
        text: "Usuń ostatnią",
      });
      removeSetBtn.onclick = () => {
        if (ex.sets.length > 1) {
          ex.sets.pop();
          this.renderAllExercises();
          this.persistActiveSession();
        }
      };
    }
  }

  /**
   * Renderuje wiersz serii z obsługą Ghost Textu
   */
  private renderSetRow(
    tbody: HTMLElement,
    ex: WorkoutExercise,
    set: WorkoutSet,
    setIndex: number
  ) {
    const row = tbody.createEl("tr", {
      cls: `workout-set-row ${set.completed ? "is-completed" : ""}`,
    });
    row.dataset.setId = set.id;

    // 1. Numer serii
    const setNumCell = row.createEl("td", { cls: "col-set" });
    setNumCell.createSpan({
      cls: "workout-set-number-badge",
      text: `${setIndex + 1}`,
    });

    // 2. Poprzednio (Poprzedni trening)
    const prevCell = row.createEl("td", { cls: "col-prev" });
    const prevText =
      set.previousKg !== undefined && set.previousReps !== undefined
        ? `${set.previousKg}kg × ${set.previousReps}`
        : "—";
    prevCell.createSpan({ cls: "workout-prev-text", text: prevText });

    // 3. Waga (KG) - Input numeryczny z ghost textem (placeholder)
    const weightCell = row.createEl("td", { cls: "col-weight" });
    const weightInput = weightCell.createEl("input", {
      cls: "workout-input-number workout-input-weight",
      type: "text",
    });
    weightInput.setAttribute("inputmode", "decimal");
    weightInput.placeholder =
      set.previousKg !== undefined ? set.previousKg.toString() : "0.0";
    if (set.kg !== null && set.kg !== undefined) {
      weightInput.value = set.kg.toString();
    }
    if (set.completed) {
      weightInput.disabled = true;
    }

    weightInput.onchange = () => {
      const val = parseFloat(weightInput.value.replace(",", "."));
      set.kg = !isNaN(val) ? val : null;
      this.persistActiveSession();
    };

    // 4. Powtórzenia (POWT.) - Input numeryczny z ghost textem
    const repsCell = row.createEl("td", { cls: "col-reps" });
    const repsInput = repsCell.createEl("input", {
      cls: "workout-input-number workout-input-reps",
      type: "text",
    });
    repsInput.setAttribute("inputmode", "numeric");
    repsInput.placeholder =
      set.previousReps !== undefined ? set.previousReps.toString() : "0";
    if (set.reps !== null && set.reps !== undefined) {
      repsInput.value = set.reps.toString();
    }
    if (set.completed) {
      repsInput.disabled = true;
    }

    repsInput.onchange = () => {
      const val = parseInt(repsInput.value, 10);
      set.reps = !isNaN(val) ? val : null;
      this.persistActiveSession();
    };

    // 5. Przycisk zatwierdzenia serii [ ✓ ]
    const statusCell = row.createEl("td", { cls: "col-status" });
    const checkBtn = statusCell.createEl("button", {
      cls: `workout-btn-check ${set.completed ? "is-checked" : ""}`,
    });
    checkBtn.innerHTML = set.completed ? "✓" : "";

    checkBtn.onclick = () => {
      if (set.completed) {
        // Kliknięcie w zatwierdzoną serię odblokowuje ją (cofnięcie pomyłki)
        set.completed = false;
        row.removeClass("is-completed");
        checkBtn.removeClass("is-checked");
        checkBtn.innerHTML = "";
        weightInput.disabled = false;
        repsInput.disabled = false;
        this.persistActiveSession();
        return;
      }

      // Logika zatwierdzania: Jeśli pola są puste, przejmij wartości z ghost textu!
      if (set.kg === null || isNaN(set.kg)) {
        if (set.previousKg !== undefined) {
          set.kg = set.previousKg;
          weightInput.value = set.kg.toString();
        } else {
          set.kg = 0;
        }
      }

      if (set.reps === null || isNaN(set.reps)) {
        if (set.previousReps !== undefined) {
          set.reps = set.previousReps;
          repsInput.value = set.reps.toString();
        } else {
          set.reps = 0;
        }
      }

      set.completed = true;
      row.addClass("is-completed");
      checkBtn.addClass("is-checked");
      checkBtn.innerHTML = "✓";
      weightInput.disabled = true;
      repsInput.disabled = true;

      // Zapisz stan po zatwierdzeniu serii
      this.persistActiveSession();

      // Automatyczny start timera odpoczynku
      const restSeconds = ex.defaultRestSeconds || this.plugin.settings.defaultRestSeconds;
      this.startRestTimer(restSeconds, ex.exerciseName);
    };
  }

  /**
   * Dolny pasek: Dodaj ćwiczenie oraz Zakończ i Zapisz
   */
  private renderBottomBar(container: HTMLElement) {
    const bottomBar = container.createDiv({ cls: "workout-modal-bottom-bar" });

    const addExBtn = bottomBar.createEl("button", {
      cls: "workout-btn-full workout-btn-secondary",
      text: "+ Dodaj ćwiczenie do sesji",
    });
    addExBtn.onclick = () => {
      new ExercisePickerModal(
        this.app,
        this.storage,
        this.plugin.settings,
        async (pickedName) => {
          await this.addExerciseToWorkout(pickedName);
        }
      ).open();
    };

    const finishBtn = bottomBar.createEl("button", {
      cls: "workout-btn-full workout-btn-primary workout-btn-finish",
      text: "ZAKOŃCZ I ZAPISZ TRENING",
    });
    finishBtn.onclick = () => {
      this.finishAndSaveWorkout();
    };
  }

  /**
   * Dodaje nowe ćwiczenie do aktywnej sesji
   */
  private async addExerciseToWorkout(exerciseName: string) {
    const lastPerf = await this.storage.getLastExercisePerformance(
      exerciseName,
      this.plugin.settings.logsFolder
    );
    const meta = this.exerciseMap.get(exerciseName.toLowerCase());

    const newEx: WorkoutExercise = {
      id: "ex_" + Date.now(),
      exerciseName,
      muscleGroup: meta?.muscleGroup,
      secondaryMuscles: meta?.secondaryMuscles,
      coverPath: meta?.cover,
      defaultRestSeconds: meta?.defaultRest || this.plugin.settings.defaultRestSeconds,
      sets: [
        {
          id: "set_1_" + Date.now(),
          setNumber: 1,
          previousKg: lastPerf?.kg,
          previousReps: lastPerf?.reps,
          kg: null,
          reps: null,
          completed: false,
        },
        {
          id: "set_2_" + Date.now(),
          setNumber: 2,
          previousKg: lastPerf?.kg,
          previousReps: lastPerf?.reps,
          kg: null,
          reps: null,
          completed: false,
        },
        {
          id: "set_3_" + Date.now(),
          setNumber: 3,
          previousKg: lastPerf?.kg,
          previousReps: lastPerf?.reps,
          kg: null,
          reps: null,
          completed: false,
        },
      ],
    };

    this.workout.exercises.push(newEx);
    this.renderAllExercises();
    this.persistActiveSession();

    // Przewiń do dodanego ćwiczenia
    setTimeout(() => {
      this.exercisesContainerEl.scrollTo({
        top: this.exercisesContainerEl.scrollHeight,
        behavior: "smooth",
      });
    }, 50);
  }

  /**
   * Logika timera odpoczynku
   */
  private startRestTimer(seconds: number, exerciseName?: string) {
    this.stopRestTimer(false);

    const targetTimestamp = Date.now() + seconds * 1000;
    this.workout.activeRestTimer = {
      targetTimestamp,
      totalSeconds: seconds,
      exerciseName,
    };
    this.persistActiveSession();

    this.restTimerContainerEl.removeClass("is-hidden");

    this.updateRestTimerDisplay();
    this.restInterval = window.setInterval(() => {
      this.updateRestTimerDisplay();
    }, 500);
  }

  private resumeRestTimer() {
    if (!this.workout.activeRestTimer) return;
    this.restTimerContainerEl.removeClass("is-hidden");
    this.updateRestTimerDisplay();
    this.restInterval = window.setInterval(() => {
      this.updateRestTimerDisplay();
    }, 500);
  }

  private adjustRestTimer(deltaSeconds: number) {
    if (!this.workout.activeRestTimer) return;
    this.workout.activeRestTimer.targetTimestamp += deltaSeconds * 1000;
    this.workout.activeRestTimer.totalSeconds += deltaSeconds;
    this.updateRestTimerDisplay();
    this.persistActiveSession();
  }

  private updateRestTimerDisplay() {
    if (!this.workout.activeRestTimer) return;

    const remainingMs = this.workout.activeRestTimer.targetTimestamp - Date.now();
    const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
    const totalSec = this.workout.activeRestTimer.totalSeconds;

    const remMin = Math.floor(remainingSec / 60);
    const remS = remainingSec % 60;
    const totMin = Math.floor(totalSec / 60);
    const totS = totalSec % 60;

    const remStr = `${remMin.toString().padStart(2, "0")}:${remS.toString().padStart(2, "0")}`;
    const totStr = `${totMin.toString().padStart(2, "0")}:${totS.toString().padStart(2, "0")}`;

    this.restTimerLabelEl.setText(`⏱ ODPOCZYNEK: ${remStr} / ${totStr}`);

    // Pasek postępu (malejący)
    const progressPercent = Math.min(100, Math.max(0, (remainingSec / totalSec) * 100));
    this.restTimerProgressEl.style.width = `${progressPercent}%`;

    if (remainingSec <= 0) {
      this.onRestTimerComplete();
    }
  }

  private onRestTimerComplete() {
    const exName = this.workout.activeRestTimer?.exerciseName || "Kolejna seria";
    this.stopRestTimer(false);

    // 1. Podwójny sygnał wibracyjny (Android / Smartwatch)
    if (this.plugin.settings.enableVibration && typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(this.plugin.settings.vibrationPattern);
      } catch (e) {
        console.debug("Vibration not supported or blocked", e);
      }
    }

    // 2. Syntetyzowany dźwięk (Web Audio API - brak zewnętrznych plików MP3!)
    if (this.plugin.settings.enableSound) {
      this.playChime();
    }

    // 3. Powiadomienie PUSH (Web Notifications API -> Android Drawer -> Smartwatch)
    if (this.plugin.settings.enableNotifications) {
      this.sendSystemNotification(
        "Czas na serię! ⏱",
        `Odpoczynek minął. Czas na wykonanie serii w: ${exName}`
      );
    }

    new Notice(`⏱ Koniec odpoczynku! Czas na: ${exName}`);
  }

  private stopRestTimer(userSkipped: boolean = false) {
    if (this.restInterval !== null) {
      window.clearInterval(this.restInterval);
      this.restInterval = null;
    }
    this.workout.activeRestTimer = null;
    this.restTimerContainerEl.addClass("is-hidden");
    this.persistActiveSession();

    if (userSkipped) {
      new Notice("Odpoczynek pominięty");
    }
  }

  /**
   * Główny timer czasu trwania treningu (00:00:00)
   */
  private startWorkoutTimer() {
    this.workoutInterval = window.setInterval(() => {
      const elapsedMs = Date.now() - this.workout.startTime;
      this.headerDurationEl.setText(this.formatDuration(elapsedMs));
      this.plugin.updateStatusBar(this.formatDuration(elapsedMs));
    }, 1000);
  }

  private stopWorkoutTimer() {
    if (this.workoutInterval !== null) {
      window.clearInterval(this.workoutInterval);
      this.workoutInterval = null;
    }
    this.plugin.clearStatusBar();
  }

  private formatDuration(ms: number): string {
    const totalSec = Math.floor(Math.max(0, ms) / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Dźwięk sygnału odpoczynku (Syntetyzowany podwójny dzwonek)
   */
  private playChime() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.audioCtx || this.audioCtx.state === "closed") {
        this.audioCtx = new AudioCtxClass();
      }

      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Pierwszy ton (880 Hz - A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Drugi ton (1760 Hz - A6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1760, now + 0.15);
      gain2.gain.setValueAtTime(0.4, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.45);
    } catch (e) {
      console.debug("AudioContext error", e);
    }
  }

  /**
   * Systemowe powiadomienie PUSH
   */
  private requestNotificationPermission() {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try {
        Notification.requestPermission();
      } catch (e) {
        console.debug("Notification permission request failed", e);
      }
    }
  }

  private sendSystemNotification(title: string, body: string) {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%2310b981'><circle cx='12' cy='12' r='10'/></svg>",
        });
      } catch (e) {
        console.debug("Notification dispatch error", e);
      }
    }
  }

  /**
   * Zakończenie i trwały zapis do Workouts/Logs/
   */
  private async finishAndSaveWorkout() {
    this.workout.endTime = Date.now();

    try {
      const logFile = await this.storage.saveWorkoutLog(
        this.workout,
        this.plugin.settings
      );

      // Usuń stan aktywnego treningu po pomyślnym zapisie
      await this.plugin.clearActiveWorkout();

      new Notice(`✓ Trening zapisany w: ${logFile.path}`, 6000);
      this.close();
    } catch (err) {
      console.error("Błąd zapisu treningu:", err);
      new Notice(`Błąd podczas zapisywania treningu: ${err}`);
    }
  }

  /**
   * Dialog porzucenia treningu
   */
  private promptCancelWorkout() {
    const confirmCancel = window.confirm(
      "Czy na pewno chcesz porzucić ten trening? Wprowadzone serie zostaną utracone."
    );
    if (confirmCancel) {
      this.plugin.clearActiveWorkout();
      new Notice("Trening został porzucony");
      this.close();
    }
  }

  /**
   * Zapisuje bieżący stan sesji w data.json pluginu (ochrona przed Android LMK)
   */
  private persistActiveSession() {
    this.plugin.saveActiveWorkout(this.workout);
  }

  private resolveAttachmentPath(path: string): string {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (file) {
      return this.app.vault.getResourcePath(file as any);
    }
    return path;
  }
}

/**
 * Modal informacji o technice wykonania ćwiczenia [ ℹ Info ]
 */
export class ExerciseInfoModal extends Modal {
  private exerciseName: string;
  private meta?: ExerciseMeta;

  constructor(app: App, exerciseName: string, meta?: ExerciseMeta) {
    super(app);
    this.exerciseName = exerciseName;
    this.meta = meta;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("workout-info-modal");

    const header = contentEl.createDiv({ cls: "workout-info-header" });
    header.createEl("h2", { text: this.exerciseName });

    if (this.meta?.cover) {
      const img = contentEl.createEl("img", {
        cls: "workout-info-cover",
      });
      const file = this.app.vault.getAbstractFileByPath(this.meta.cover);
      if (file) {
        img.src = this.app.vault.getResourcePath(file as any);
      } else {
        img.src = this.meta.cover;
      }
      img.onerror = () => {
        img.style.display = "none";
      };
    }

    const metaGrid = contentEl.createDiv({ cls: "workout-info-meta-grid" });
    if (this.meta?.muscleGroup) {
      const col = metaGrid.createDiv({ cls: "workout-info-meta-item" });
      col.createSpan({ cls: "meta-label", text: "Główna partia:" });
      col.createSpan({ cls: "meta-val", text: this.meta.muscleGroup });
    }

    if (this.meta?.secondaryMuscles && this.meta.secondaryMuscles.length > 0) {
      const col = metaGrid.createDiv({ cls: "workout-info-meta-item" });
      col.createSpan({ cls: "meta-label", text: "Partie asystujące:" });
      col.createSpan({
        cls: "meta-val",
        text: this.meta.secondaryMuscles.join(", "),
      });
    }

    const contentBox = contentEl.createDiv({ cls: "workout-info-markdown" });
    if (this.meta?.content) {
      contentBox.innerHTML = this.formatBasicMarkdown(this.meta.content);
    } else {
      contentBox.createEl("p", {
        cls: "workout-text-muted",
        text: `Brak notatki z opisem technicznym w Workouts/Exercises/${this.exerciseName}.md. Możesz ją utworzyć w vaulcie!`,
      });
    }

    const closeBtn = contentEl.createEl("button", {
      cls: "workout-btn-full workout-btn-secondary",
      text: "Zamknij",
    });
    closeBtn.onclick = () => this.close();
  }

  private formatBasicMarkdown(md: string): string {
    return md
      .replace(/^### (.*$)/gim, "<h4>$1</h4>")
      .replace(/^## (.*$)/gim, "<h3>$1</h3>")
      .replace(/^# (.*$)/gim, "<h2>$1</h2>")
      .replace(/^\d+\.\s+(.*$)/gim, "<li>$1</li>")
      .replace(/\n\n/g, "<br/><br/>");
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal wyboru ćwiczenia do dodania do trwającej sesji
 */
export class ExercisePickerModal extends Modal {
  private storage: WorkoutStorage;
  private settings: any;
  private onPick: (name: string) => void;

  constructor(
    app: App,
    storage: WorkoutStorage,
    settings: any,
    onPick: (name: string) => void
  ) {
    super(app);
    this.storage = storage;
    this.settings = settings;
    this.onPick = onPick;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("workout-picker-modal");

    contentEl.createEl("h3", { text: "Wybierz ćwiczenie do sesji" });

    const searchInput = contentEl.createEl("input", {
      cls: "workout-search-input",
      type: "text",
      placeholder: "Szukaj ćwiczenia...",
    });

    const listEl = contentEl.createDiv({ cls: "workout-picker-list" });

    const exercises = await this.storage.loadExercises(this.settings);
    const exerciseList = Array.from(exercises.values());

    const renderFiltered = (query: string) => {
      listEl.empty();
      const filtered = exerciseList.filter((ex) =>
        ex.name.toLowerCase().includes(query.toLowerCase())
      );

      if (filtered.length === 0) {
        const item = listEl.createDiv({ cls: "workout-picker-empty" });
        item.createEl("p", {
          text: `Brak wyników. Możesz dodać własne ćwiczenie: "${query}"`,
        });
        if (query.trim()) {
          const createBtn = item.createEl("button", {
            cls: "workout-btn-sm workout-btn-primary",
            text: `Dodaj "${query.trim()}"`,
          });
          createBtn.onclick = () => {
            this.onPick(query.trim());
            this.close();
          };
        }
        return;
      }

      filtered.forEach((ex) => {
        const row = listEl.createDiv({ cls: "workout-picker-row" });
        const left = row.createDiv();
        left.createDiv({ cls: "workout-picker-row-title", text: ex.name });
        left.createDiv({ cls: "workout-picker-row-sub", text: ex.muscleGroup });

        const pickBtn = row.createEl("button", {
          cls: "workout-btn-sm workout-btn-secondary",
          text: "+ Wybierz",
        });
        pickBtn.onclick = () => {
          this.onPick(ex.name);
          this.close();
        };
      });
    };

    renderFiltered("");
    searchInput.oninput = () => renderFiltered(searchInput.value);
    setTimeout(() => searchInput.focus(), 50);
  }

  onClose() {
    this.contentEl.empty();
  }
}
