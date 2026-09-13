import {
  App,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
} from "obsidian";
import { WorkoutStorage } from "./storage";
import {
  ActiveWorkout,
  BodyMeasurementEntry,
  DEFAULT_SETTINGS,
  WorkoutExercise,
  WorkoutTemplate,
  WorkoutTrackerSettings,
} from "./types";
import { ActiveWorkoutModal } from "./workout-modal";

export default class WorkoutTrackerPlugin extends Plugin {
  settings!: WorkoutTrackerSettings;
  storage!: WorkoutStorage;
  activeWorkout: ActiveWorkout | null = null;
  private statusBarItem: HTMLElement | null = null;

  async onload() {
    console.log("Ładowanie wtyczki Workout Tracker (Hevy Style)...");

    await this.loadSettings();
    this.storage = new WorkoutStorage(this.app);

    // Sprawdź czy istnieje aktywna sesja po restarcie Obsidiana (ochrona przed Android LMK)
    const storedData = await this.loadData();
    if (storedData?.activeWorkout) {
      this.activeWorkout = storedData.activeWorkout;
      const elapsedMins = Math.floor(
        (Date.now() - this.activeWorkout.startTime) / 60000
      );
      new Notice(
        `Wykryto niezakończony trening: ${this.activeWorkout.templateName} (${elapsedMins} min temu). Użyj ikony hantla lub komendy, aby wznowić!`,
        10000
      );
    }

    // Dodanie ikony na pasku bocznym (Ribbon Icon)
    this.addRibbonIcon("dumbbell", "Workout Tracker (Trening)", () => {
      if (this.activeWorkout) {
        new ActiveWorkoutModal(this.app, this, this.activeWorkout).open();
      } else {
        new TemplateSelectModal(this.app, this).open();
      }
    });

    // Pasek stanu (Status Bar)
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBarDisplay();

    // Rejestracja komend w Obsidianie
    this.addCommand({
      id: "start-workout",
      name: "Rozpocznij nowy trening (Wybierz szablon)",
      callback: () => {
        new TemplateSelectModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "resume-workout",
      name: "Wznów trwający trening",
      checkCallback: (checking: boolean) => {
        if (this.activeWorkout) {
          if (!checking) {
            new ActiveWorkoutModal(this.app, this, this.activeWorkout).open();
          }
          return true;
        }
        return false;
      },
    });

    this.addCommand({
      id: "open-body-tracker",
      name: "Pomiary ciała (Body Tracker)",
      callback: () => {
        new BodyTrackerModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: "seed-sample-workouts",
      name: "Zainicjalizuj strukturę folderów i przykładowe szablony",
      callback: async () => {
        await this.storage.createSeedData(this.settings);
        new Notice("Pomyślnie utworzono foldery i przykładowe szablony w Workouts/");
      },
    });

    // Dodanie zakładki w ustawieniach Obsidiana
    this.addSettingTab(new WorkoutTrackerSettingTab(this.app, this));
  }

  onunload() {
    console.log("Wyładowywanie wtyczki Workout Tracker...");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData({
      ...this.settings,
      activeWorkout: this.activeWorkout,
    });
  }

  async saveActiveWorkout(workout: ActiveWorkout) {
    this.activeWorkout = workout;
    await this.saveData({
      ...this.settings,
      activeWorkout: workout,
    });
    this.updateStatusBarDisplay();
  }

  async clearActiveWorkout() {
    this.activeWorkout = null;
    await this.saveData({
      ...this.settings,
      activeWorkout: null,
    });
    this.clearStatusBar();
  }

  updateStatusBar(timeFormatted: string) {
    if (this.statusBarItem && this.activeWorkout) {
      this.statusBarItem.setText(`🏋️ ${this.activeWorkout.templateName} (${timeFormatted})`);
      this.statusBarItem.style.display = "inline-block";
    }
  }

  clearStatusBar() {
    if (this.statusBarItem) {
      this.statusBarItem.setText("");
      this.statusBarItem.style.display = "none";
    }
  }

  private updateStatusBarDisplay() {
    if (this.activeWorkout) {
      const elapsed = Math.max(0, Date.now() - this.activeWorkout.startTime);
      const mins = Math.floor(elapsed / 60000);
      this.updateStatusBar(`${mins}m`);
    } else {
      this.clearStatusBar();
    }
  }
}

/**
 * Modal wyboru szablonu treningowego przed startem sesji
 */
export class TemplateSelectModal extends Modal {
  private plugin: WorkoutTrackerPlugin;

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("workout-template-select-modal");

    const header = contentEl.createDiv({ cls: "workout-select-header" });
    header.createEl("h2", { text: "Rozpocznij Trening" });

    // Przycisk szybkiego startu bez szablonu (Freestyle)
    const freestyleBtn = contentEl.createEl("button", {
      cls: "workout-btn-full workout-btn-primary workout-mb-4",
      text: "⚡ Rozpocznij pusty trening (Freestyle)",
    });
    freestyleBtn.onclick = () => {
      this.startWorkoutSession("Trening Dowolny", []);
    };

    contentEl.createEl("h4", {
      cls: "workout-templates-subtitle",
      text: "Wybierz z szablonów:",
    });

    const templates = await this.plugin.storage.loadTemplates(this.plugin.settings);

    if (templates.length === 0) {
      const emptyWrap = contentEl.createDiv({ cls: "workout-empty-state" });
      emptyWrap.createEl("p", {
        text: `Nie znaleziono szablonów w folderze "${this.plugin.settings.templatesFolder}".`,
      });
      const seedBtn = emptyWrap.createEl("button", {
        cls: "workout-btn-secondary",
        text: "Utwórz przykładowe szablony (Trening A i B)",
      });
      seedBtn.onclick = async () => {
        await this.plugin.storage.createSeedData(this.plugin.settings);
        new Notice("Utworzono przykłady!");
        this.close();
        new TemplateSelectModal(this.app, this.plugin).open();
      };
      return;
    }

    const listEl = contentEl.createDiv({ cls: "workout-template-list" });

    for (const tmpl of templates) {
      const card = listEl.createDiv({ cls: "workout-template-card" });
      const topRow = card.createDiv({ cls: "workout-template-card-top" });
      topRow.createEl("h3", { text: tmpl.name });

      const exCount = tmpl.exercises?.length || 0;
      topRow.createSpan({
        cls: "workout-badge",
        text: `${exCount} ćwiczeń`,
      });

      if (tmpl.exercises && tmpl.exercises.length > 0) {
        const preview = card.createDiv({ cls: "workout-template-exercises-preview" });
        preview.setText(tmpl.exercises.map((e) => e.name).join(" • "));
      }

      const startBtn = card.createEl("button", {
        cls: "workout-btn-full workout-btn-secondary workout-mt-2",
        text: "Rozpocznij ten trening",
      });
      startBtn.onclick = async () => {
        await this.startWorkoutFromTemplate(tmpl);
      };
    }
  }

  private async startWorkoutFromTemplate(tmpl: WorkoutTemplate) {
    const exercisesMeta = await this.plugin.storage.loadExercises(this.plugin.settings);
    const exercises: WorkoutExercise[] = [];

    for (const tmplEx of tmpl.exercises) {
      const lastPerf = await this.plugin.storage.getLastExercisePerformance(
        tmplEx.name,
        this.plugin.settings.logsFolder
      );
      const meta = exercisesMeta.get(tmplEx.name.toLowerCase());

      const numSets = tmplEx.sets || 3;
      const sets = [];

      for (let s = 1; s <= numSets; s++) {
        // Spróbuj dopasować poprzedni ciężar z odpowiadającej serii lub ogólny
        const setPrev =
          lastPerf?.allSets && lastPerf.allSets[s - 1]
            ? lastPerf.allSets[s - 1]
            : lastPerf;

        sets.push({
          id: `set_${s}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
          setNumber: s,
          previousKg: setPrev?.kg ?? tmplEx.defaultWeight,
          previousReps: setPrev?.reps,
          kg: null,
          reps: null,
          completed: false,
        });
      }

      exercises.push({
        id: "ex_" + Date.now() + "_" + Math.random().toString(36).substring(2, 5),
        exerciseName: tmplEx.name,
        muscleGroup: meta?.muscleGroup,
        secondaryMuscles: meta?.secondaryMuscles,
        coverPath: meta?.cover,
        defaultRestSeconds:
          tmplEx.defaultRest ||
          meta?.defaultRest ||
          tmpl.defaultRestSeconds ||
          this.plugin.settings.defaultRestSeconds,
        sets,
      });
    }

    this.startWorkoutSession(tmpl.name, exercises);
  }

  private startWorkoutSession(title: string, exercises: WorkoutExercise[]) {
    const newWorkout: ActiveWorkout = {
      id: "workout_" + Date.now(),
      templateName: title,
      startTime: Date.now(),
      exercises,
      activeRestTimer: null,
    };

    this.plugin.saveActiveWorkout(newWorkout);
    this.close();
    new ActiveWorkoutModal(this.app, this.plugin, newWorkout).open();
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Modal pomiarów ciała (Body Tracker)
 */
export class BodyTrackerModal extends Modal {
  private plugin: WorkoutTrackerPlugin;

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("workout-body-tracker-modal");

    contentEl.createEl("h2", { text: "Pomiary ciała (Body Tracker)" });

    // Formularz dodawania nowego pomiaru
    const formBox = contentEl.createDiv({ cls: "workout-body-form-box" });
    formBox.createEl("h4", { text: "+ Dodaj nowy pomiar" });

    const todayStr = new Date().toISOString().split("T")[0];

    const grid = formBox.createDiv({ cls: "workout-form-grid" });

    const createField = (label: string, placeholder: string, defaultValue: string = "") => {
      const col = grid.createDiv({ cls: "workout-form-group" });
      col.createEl("label", { text: label });
      const input = col.createEl("input", { type: "text", placeholder });
      if (defaultValue) input.value = defaultValue;
      return input;
    };

    const dateInput = createField("Data", "YYYY-MM-DD", todayStr);
    const weightInput = createField("Waga (kg)", "np. 82.5");
    const chestInput = createField("Klatka (cm)", "np. 108");
    const armInput = createField("Ramię (cm)", "np. 39.5");
    const waistInput = createField("Pas (cm)", "np. 84");
    const thighInput = createField("Udo (cm)", "np. 61.5");
    const notesInput = createField("Notatki", "np. Rano na czczo");

    const saveBtn = formBox.createEl("button", {
      cls: "workout-btn-primary workout-mt-3",
      text: "Zapisz pomiar do Body Tracker.md",
    });

    saveBtn.onclick = async () => {
      const date = dateInput.value.trim();
      if (!date) {
        new Notice("Wprowadź prawidłową datę");
        return;
      }

      const entry: BodyMeasurementEntry = {
        date,
        weight: parseFloat(weightInput.value.replace(",", ".")) || undefined,
        chest: parseFloat(chestInput.value.replace(",", ".")) || undefined,
        arm: parseFloat(armInput.value.replace(",", ".")) || undefined,
        waist: parseFloat(waistInput.value.replace(",", ".")) || undefined,
        thigh: parseFloat(thighInput.value.replace(",", ".")) || undefined,
        notes: notesInput.value.trim() || undefined,
      };

      await this.plugin.storage.appendBodyMeasurement(
        entry,
        this.plugin.settings.bodyTrackerFile
      );
      new Notice("✓ Pomiar został pomyślnie dodany do pliku!");
      this.close();
    };

    // Tabela ostatnich pomiarów
    contentEl.createEl("h4", {
      cls: "workout-mt-4",
      text: "Ostatnie pomiary w vaulcie:",
    });
    const entries = await this.plugin.storage.loadBodyTracker(
      this.plugin.settings.bodyTrackerFile
    );

    if (entries.length === 0) {
      contentEl.createEl("p", {
        cls: "workout-text-muted",
        text: `Brak wcześniejszych wpisów w ${this.plugin.settings.bodyTrackerFile}.`,
      });
      return;
    }

    const tableWrap = contentEl.createDiv({ cls: "workout-table-responsive" });
    const table = tableWrap.createEl("table", { cls: "workout-sets-table" });
    const thead = table.createEl("thead");
    const htr = thead.createEl("tr");
    htr.createEl("th", { text: "Data" });
    htr.createEl("th", { text: "Waga (kg)" });
    htr.createEl("th", { text: "Klatka" });
    htr.createEl("th", { text: "Ramię" });
    htr.createEl("th", { text: "Pas" });
    htr.createEl("th", { text: "Udo" });
    htr.createEl("th", { text: "Notatki" });

    const tbody = table.createEl("tbody");
    entries.slice(-10).reverse().forEach((e) => {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: e.date });
      tr.createEl("td", { text: e.weight ? `${e.weight} kg` : "--" });
      tr.createEl("td", { text: e.chest ? `${e.chest} cm` : "--" });
      tr.createEl("td", { text: e.arm ? `${e.arm} cm` : "--" });
      tr.createEl("td", { text: e.waist ? `${e.waist} cm` : "--" });
      tr.createEl("td", { text: e.thigh ? `${e.thigh} cm` : "--" });
      tr.createEl("td", { text: e.notes || "" });
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

/**
 * Ustawienia wtyczki (Obsidian Settings Tab)
 */
class WorkoutTrackerSettingTab extends PluginSettingTab {
  plugin: WorkoutTrackerPlugin;

  constructor(app: App, plugin: WorkoutTrackerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Workout Tracker (Hevy Style) — Ustawienia" });

    new Setting(containerEl)
      .setName("Folder szablonów")
      .setDesc("Ścieżka do folderu z szablonami treningów w vaulcie")
      .addText((text) =>
        text
          .setPlaceholder("Workouts/Templates")
          .setValue(this.plugin.settings.templatesFolder)
          .onChange(async (val) => {
            this.plugin.settings.templatesFolder = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder ćwiczeń (Baza wiedzy)")
      .setDesc("Ścieżka do folderu z notatkami ćwiczeń i instrukcjami technicznymi")
      .addText((text) =>
        text
          .setPlaceholder("Workouts/Exercises")
          .setValue(this.plugin.settings.exercisesFolder)
          .onChange(async (val) => {
            this.plugin.settings.exercisesFolder = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Folder dziennika treningów (Logs)")
      .setDesc("Gdzie mają być automatycznie zapisywane notatki z wykonanych sesji")
      .addText((text) =>
        text
          .setPlaceholder("Workouts/Logs")
          .setValue(this.plugin.settings.logsFolder)
          .onChange(async (val) => {
            this.plugin.settings.logsFolder = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Plik Body Tracker")
      .setDesc("Ścieżka do centralnego pliku z pomiarami wagi i obwodów")
      .addText((text) =>
        text
          .setPlaceholder("Workouts/Body Tracker.md")
          .setValue(this.plugin.settings.bodyTrackerFile)
          .onChange(async (val) => {
            this.plugin.settings.bodyTrackerFile = val.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Domyślny czas odpoczynku (sekundy)")
      .setDesc("Czas trwania timera odpoczynku po zatwierdzeniu serii")
      .addSlider((slider) =>
        slider
          .setLimits(30, 300, 15)
          .setValue(this.plugin.settings.defaultRestSeconds)
          .setDynamicTooltip()
          .onChange(async (val) => {
            this.plugin.settings.defaultRestSeconds = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Wibracje po zakończeniu odpoczynku")
      .setDesc("Wibracja telefonu (Android) sygnalizująca koniec przerwy")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableVibration)
          .onChange(async (val) => {
            this.plugin.settings.enableVibration = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Dźwięk sygnału (Web Audio)")
      .setDesc("Syntetyzowany podwójny sygnał dźwiękowy (nie wymaga plików audio)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableSound)
          .onChange(async (val) => {
            this.plugin.settings.enableSound = val;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Powiadomienia systemowe (Smartwatch)")
      .setDesc("Wysyłaj powiadomienie systemowe PUSH (przekazywane na zegarek przez Android)")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableNotifications)
          .onChange(async (val) => {
            this.plugin.settings.enableNotifications = val;
            await this.plugin.saveSettings();
          })
      );
  }
}
