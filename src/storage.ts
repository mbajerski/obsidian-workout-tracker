import { App, TFile, TFolder, normalizePath, parseYaml, stringifyYaml } from "obsidian";
import {
  ActiveWorkout,
  BodyMeasurementEntry,
  ExerciseMeta,
  WorkoutSet,
  WorkoutTemplate,
  WorkoutTrackerSettings,
} from "./types";

export class WorkoutStorage {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  /**
   * Tworzy wymaganą strukturę folderów w vaulcie, jeśli jeszcze nie istnieje
   */
  async ensureFoldersExist(settings: WorkoutTrackerSettings): Promise<void> {
    const folders = [
      settings.templatesFolder,
      settings.exercisesFolder,
      settings.logsFolder,
      "Workouts",
    ];

    for (const folderPath of folders) {
      const normalized = normalizePath(folderPath);
      const existing = this.app.vault.getAbstractFileByPath(normalized);
      if (!existing) {
        try {
          await this.app.vault.createFolder(normalized);
        } catch (e) {
          // Folder może zostać utworzony równolegle lub już istnieć
          console.debug(`Folder exists or creation skipped: ${normalized}`, e);
        }
      }
    }
  }

  /**
   * Wczytuje wszystkie szablony treningowe z folderu Templates
   */
  async loadTemplates(settings: WorkoutTrackerSettings): Promise<WorkoutTemplate[]> {
    await this.ensureFoldersExist(settings);
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(settings.templatesFolder));
    if (!(folder instanceof TFolder)) {
      return [];
    }

    const templates: WorkoutTemplate[] = [];

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        try {
          const content = await this.app.vault.read(child);
          const cache = this.app.metadataCache.getFileCache(child);
          const frontmatter = cache?.frontmatter || {};

          const exercisesRaw = frontmatter.exercises || [];
          const exercises = Array.isArray(exercisesRaw)
            ? exercisesRaw.map((ex: any) => {
                if (typeof ex === "string") {
                  return { name: ex, sets: 3, targetReps: "8-10" };
                }
                return {
                  name: ex.name || "Ćwiczenie",
                  sets: Number(ex.sets) || 3,
                  targetReps: ex.targetReps || "8-10",
                  defaultWeight: ex.defaultWeight ? Number(ex.defaultWeight) : undefined,
                  defaultRest: ex.defaultRest ? Number(ex.defaultRest) : undefined,
                };
              })
            : [];

          templates.push({
            name: frontmatter.name || child.basename,
            filePath: child.path,
            defaultRestSeconds: Number(frontmatter.defaultRestSeconds) || settings.defaultRestSeconds,
            exercises,
            notes: content.replace(/^---[\s\S]*?---/, "").trim(),
          });
        } catch (err) {
          console.error(`Błąd wczytywania szablonu ${child.path}:`, err);
        }
      }
    }

    return templates;
  }

  /**
   * Wczytuje bazę wiedzy ćwiczeń z folderu Exercises
   */
  async loadExercises(settings: WorkoutTrackerSettings): Promise<Map<string, ExerciseMeta>> {
    await this.ensureFoldersExist(settings);
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(settings.exercisesFolder));
    const exerciseMap = new Map<string, ExerciseMeta>();

    if (!(folder instanceof TFolder)) {
      return exerciseMap;
    }

    for (const child of folder.children) {
      if (child instanceof TFile && child.extension === "md") {
        try {
          const content = await this.app.vault.read(child);
          const cache = this.app.metadataCache.getFileCache(child);
          const frontmatter = cache?.frontmatter || {};

          const secondary = Array.isArray(frontmatter.secondaryMuscles)
            ? frontmatter.secondaryMuscles
            : [];

          const exerciseName = child.basename;
          exerciseMap.set(exerciseName.toLowerCase(), {
            name: exerciseName,
            filePath: child.path,
            muscleGroup: frontmatter.muscleGroup || "Inne",
            secondaryMuscles: secondary,
            cover: frontmatter.cover || "",
            defaultRest: Number(frontmatter.defaultRest) || settings.defaultRestSeconds,
            content: content.replace(/^---[\s\S]*?---/, "").trim(),
          });
        } catch (err) {
          console.error(`Błąd wczytywania ćwiczenia ${child.path}:`, err);
        }
      }
    }

    return exerciseMap;
  }

  /**
   * Wyszukuje ostatni wykonany wynik dla danego ćwiczenia z plików Workouts/Logs/
   * Zwraca ciężar i liczbę powtórzeń (ghost text)
   */
  async getLastExercisePerformance(
    exerciseName: string,
    logsFolder: string
  ): Promise<{ kg: number; reps: number; allSets: { kg: number; reps: number }[] } | null> {
    const folder = this.app.vault.getAbstractFileByPath(normalizePath(logsFolder));
    if (!(folder instanceof TFolder)) return null;

    // Sortujemy pliki logów malejąco według nazwy (format: YYYY-MM-DD-...)
    const logFiles = folder.children
      .filter((file): file is TFile => file instanceof TFile && file.extension === "md")
      .sort((a, b) => b.name.localeCompare(a.name));

    const cleanExerciseName = exerciseName.trim().toLowerCase();

    for (const logFile of logFiles) {
      try {
        const content = await this.app.vault.read(logFile);
        const lines = content.split("\n");

        let inExerciseSection = false;
        const setsFound: { kg: number; reps: number }[] = [];

        for (const line of lines) {
          if (line.startsWith("## ")) {
            const sectionTitle = line
              .replace(/##\s+/, "")
              .replace(/\[\[.*?\|(.*?)\]\]/, "$1")
              .replace(/\[\[(.*?)\]\]/, "$1")
              .trim()
              .toLowerCase();

            if (sectionTitle.includes(cleanExerciseName) || cleanExerciseName.includes(sectionTitle)) {
              inExerciseSection = true;
            } else {
              if (inExerciseSection && setsFound.length > 0) {
                break;
              }
              inExerciseSection = false;
            }
            continue;
          }

          if (inExerciseSection && line.startsWith("|")) {
            // Tabela: | Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |
            const parts = line.split("|").map((p) => p.trim());
            // parts[0] to pusty string przed pierwszą rurką
            // parts[1]=Seria, parts[2]=Poprzednio, parts[3]=Ciężar, parts[4]=Powtórzenia, parts[5]=Status
            if (parts.length >= 5) {
              const kgStr = parts[3]?.replace(",", ".");
              const repsStr = parts[4];
              const kg = parseFloat(kgStr);
              const reps = parseInt(repsStr, 10);

              if (!isNaN(kg) && !isNaN(reps) && kg > 0 && reps > 0) {
                setsFound.push({ kg, reps });
              }
            }
          }
        }

        if (setsFound.length > 0) {
          return {
            kg: setsFound[0].kg,
            reps: setsFound[0].reps,
            allSets: setsFound,
          };
        }
      } catch (err) {
        console.error(`Błąd parsowania logu ${logFile.path}:`, err);
      }
    }

    return null;
  }

  /**
   * Zapisuje ukończony trening do pliku Markdown w Workouts/Logs/
   */
  async saveWorkoutLog(
    workout: ActiveWorkout,
    settings: WorkoutTrackerSettings
  ): Promise<TFile> {
    await this.ensureFoldersExist(settings);

    const now = new Date(workout.endTime || Date.now());
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0];

    const startTimestamp = workout.startTime;
    const endTimestamp = workout.endTime || Date.now();
    const durationMs = Math.max(0, endTimestamp - startTimestamp);

    const durHours = Math.floor(durationMs / 3600000);
    const durMinutes = Math.floor((durationMs % 3600000) / 60000);
    const durSeconds = Math.floor((durationMs % 60000) / 1000);

    const durationFormatted = `${durHours.toString().padStart(2, "0")}:${durMinutes
      .toString()
      .padStart(2, "0")}:${durSeconds.toString().padStart(2, "0")}`;

    // Obliczenie całkowitej objętości (tonażu) i liczby wykonanych serii
    let totalVolume = 0;
    let completedSetsCount = 0;

    workout.exercises.forEach((ex) => {
      ex.sets.forEach((set) => {
        if (set.completed && (set.kg ?? 0) > 0 && (set.reps ?? 0) > 0) {
          totalVolume += (set.kg || 0) * (set.reps || 0);
          completedSetsCount++;
        }
      });
    });

    const safeTitle = (workout.templateName || "Trening")
      .replace(/[\/\\?%*:|"<>]/g, "-")
      .trim();

    let fileName = `${dateStr}-${safeTitle}.md`;
    let targetPath = normalizePath(`${settings.logsFolder}/${fileName}`);

    // Jeśli plik o tej nazwie już istnieje (np. drugi trening tego samego dnia), dodaj znacznik czasu
    let counter = 1;
    while (this.app.vault.getAbstractFileByPath(targetPath)) {
      fileName = `${dateStr}-${safeTitle}-${counter}.md`;
      targetPath = normalizePath(`${settings.logsFolder}/${fileName}`);
      counter++;
    }

    const frontmatterObj: Record<string, any> = {
      type: "workout-log",
      template: `[[${settings.templatesFolder}/${workout.templateName}|${workout.templateName}]]`,
      date: dateStr,
      startTime: new Date(workout.startTime).toTimeString().split(" ")[0],
      endTime: timeStr,
      duration: durationFormatted,
      totalVolumeKg: Math.round(totalVolume * 10) / 10,
      completedSets: completedSetsCount,
    };

    let md = `---\n${stringifyYaml(frontmatterObj)}---\n\n`;
    md += `# ${workout.templateName} (${dateStr})\n\n`;

    if (workout.notes && workout.notes.trim()) {
      md += `> **Notatki z sesji:** ${workout.notes.trim()}\n\n`;
    }

    for (const ex of workout.exercises) {
      md += `## [[${settings.exercisesFolder}/${ex.exerciseName}|${ex.exerciseName}]]\n`;
      md += `| Seria | Poprzednio | Ciężar (kg) | Powtórzenia | Status |\n`;
      md += `|:-----:|:----------:|:-----------:|:-----------:|:------:|\n`;

      ex.sets.forEach((set, index) => {
        const setNum = index + 1;
        const prevText =
          set.previousKg !== undefined && set.previousReps !== undefined
            ? `${set.previousKg}kg × ${set.previousReps}`
            : "--";
        const kgText = set.kg !== null && set.kg !== undefined ? set.kg.toString() : "--";
        const repsText = set.reps !== null && set.reps !== undefined ? set.reps.toString() : "--";
        const statusText = set.completed ? "✓" : "–";

        md += `| ${setNum} | ${prevText} | ${kgText} | ${repsText} | ${statusText} |\n`;
      });

      md += "\n";
    }

    const newFile = await this.app.vault.create(targetPath, md);
    return newFile;
  }

  /**
   * Wczytuje pomiary ciała z pliku Workouts/Body Tracker.md
   */
  async loadBodyTracker(filePath: string): Promise<BodyMeasurementEntry[]> {
    const normalized = normalizePath(filePath);
    const file = this.app.vault.getAbstractFileByPath(normalized);
    if (!(file instanceof TFile)) {
      return [];
    }

    try {
      const content = await this.app.vault.read(file);
      const lines = content.split("\n");
      const entries: BodyMeasurementEntry[] = [];

      for (const line of lines) {
        if (!line.startsWith("|") || line.includes("Data") || line.includes("---") || line.includes(":---")) {
          continue;
        }

        const parts = line.split("|").map((s) => s.trim());
        if (parts.length >= 7) {
          const date = parts[1];
          if (!date || !date.match(/^\d{4}-\d{2}-\d{2}/)) continue;

          entries.push({
            date,
            weight: parseFloat(parts[2]) || undefined,
            chest: parseFloat(parts[3]) || undefined,
            arm: parseFloat(parts[4]) || undefined,
            waist: parseFloat(parts[5]) || undefined,
            thigh: parseFloat(parts[6]) || undefined,
            notes: parts[7] || undefined,
          });
        }
      }

      return entries;
    } catch (err) {
      console.error(`Błąd wczytywania Body Tracker ${filePath}:`, err);
      return [];
    }
  }

  /**
   * Dopasowuje lub dodaje nowy wpis do centralnego pliku Body Tracker.md
   */
  async appendBodyMeasurement(
    entry: BodyMeasurementEntry,
    filePath: string
  ): Promise<void> {
    const normalized = normalizePath(filePath);
    let file = this.app.vault.getAbstractFileByPath(normalized);

    const row = `| ${entry.date} | ${entry.weight ?? "--"} | ${entry.chest ?? "--"} | ${entry.arm ?? "--"} | ${entry.waist ?? "--"} | ${entry.thigh ?? "--"} | ${entry.notes || ""} |\n`;

    if (!(file instanceof TFile)) {
      const initialContent = `---
type: body-tracker
lastUpdated: ${entry.date}
---
# Pomiary ciała

| Data | Waga (kg) | Klatka (cm) | Ramię (cm) | Pas (cm) | Udo (cm) | Notatki |
|:----:|:---------:|:-----------:|:----------:|:--------:|:--------:|:-------:|
${row}`;
      await this.app.vault.create(normalized, initialContent);
      return;
    }

    const currentContent = await this.app.vault.read(file);
    const updatedContent = currentContent.trimEnd() + "\n" + row;
    await this.app.vault.modify(file, updatedContent);
  }

  /**
   * Tworzy przykładowe szablony, ćwiczenia i body tracker, jeśli vault jest świeży
   */
  async createSeedData(settings: WorkoutTrackerSettings): Promise<void> {
    await this.ensureFoldersExist(settings);

    // 1. Przykładowy Szablon Trening A
    const templatePath = normalizePath(`${settings.templatesFolder}/Trening A (Góra ciała).md`);
    if (!this.app.vault.getAbstractFileByPath(templatePath)) {
      const templateContent = `---
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
  - name: Wznosy hantli bokiem
    sets: 3
    targetReps: 12-15
    defaultWeight: 12
---
# Trening A (Góra ciała)
Zalecana rozgrzewka ogólna 5 min na wioślarzu oraz dogrzanie rotatorów barków.
`;
      await this.app.vault.create(templatePath, templateContent);
    }

    // 2. Przykładowy Szablon Trening B
    const templateBPath = normalizePath(`${settings.templatesFolder}/Trening B (Dół ciała).md`);
    if (!this.app.vault.getAbstractFileByPath(templateBPath)) {
      const templateBContent = `---
type: workout-template
name: Trening B (Dół ciała)
defaultRestSeconds: 120
exercises:
  - name: Przysiad ze sztangą
    sets: 4
    targetReps: 6-8
    defaultWeight: 100
  - name: Rumuński martwy ciąg
    sets: 3
    targetReps: 8-10
    defaultWeight: 90
  - name: Wspięcia na palce stojąc
    sets: 4
    targetReps: 15-20
    defaultWeight: 40
---
# Trening B (Dół ciała)
Skup się na pełnym zakresie ruchu w przysiadzie i stabilizacji tłoczni brzusznej.
`;
      await this.app.vault.create(templateBPath, templateBContent);
    }

    // 3. Przykładowe ćwiczenie: Wyciskanie sztangi leżąc
    const ex1Path = normalizePath(`${settings.exercisesFolder}/Wyciskanie sztangi leżąc.md`);
    if (!this.app.vault.getAbstractFileByPath(ex1Path)) {
      const ex1Content = `---
type: exercise
muscleGroup: Klatka piersiowa
secondaryMuscles: [Triceps, Przedni akton barku]
cover: "attachments/bench.png"
defaultRest: 120
---
# Wyciskanie sztangi leżąc

### Instrukcja techniczna:
1. Połóż się na ławce, ściągnij i opuść łopatki w dół (retrakcja i depresja).
2. Wbij całe stopy stabilnie w podłoże, zachowaj naturalną lordozę lędźwiową.
3. Chwyć gryf nieco szerzej niż szerokość barków.
4. Opuść sztangę po łuku do dolnej części mostka, kontrolując ciężar w fazie ekscentrycznej (ok. 2 sekundy).
5. Dynamicznie wyciśnij ciężar w górę, nie tracąc napięcia w łopatkach.
`;
      await this.app.vault.create(ex1Path, ex1Content);
    }

    // 4. Przykładowe ćwiczenie: Wiosłowanie hantlem
    const ex2Path = normalizePath(`${settings.exercisesFolder}/Wiosłowanie hantlem.md`);
    if (!this.app.vault.getAbstractFileByPath(ex2Path)) {
      const ex2Content = `---
type: exercise
muscleGroup: Plecy
secondaryMuscles: [Biceps, Tył barku]
cover: ""
defaultRest: 90
---
# Wiosłowanie hantlem

### Instrukcja techniczna:
1. Oprzyj kolano i rękę na ławce poziomej lub wykonaj opad tułowia z podparciem.
2. Plecy proste, brzuch napięty, głowa w przedłużeniu kręgosłupa.
3. Pociągnij hantel w kierunku biodra, inicjując ruch ściągnięciem łopatki.
4. Przytrzymaj spięcie mięśni grzbietu na ułamek sekundy i powoli opuść hantel.
`;
      await this.app.vault.create(ex2Path, ex2Content);
    }

    // 5. Przykładowe ćwiczenie: Przysiad ze sztangą
    const ex3Path = normalizePath(`${settings.exercisesFolder}/Przysiad ze sztangą.md`);
    if (!this.app.vault.getAbstractFileByPath(ex3Path)) {
      const ex3Content = `---
type: exercise
muscleGroup: Nogi
secondaryMuscles: [Pośladki, Prostowniki grzbietu]
cover: ""
defaultRest: 150
---
# Przysiad ze sztangą

### Instrukcja techniczna:
1. Umieść sztangę na mięśniach czworobocznych (high-bar) lub na tylnych aktonach barków (low-bar).
2. Rozstaw stóp na szerokość bioder lub nieco szerzej, palce lekko na zewnątrz.
3. Weź głęboki wdech do brzucha (manewr Valsalvy) i rozpocznij ruch od jednoczesnego zgięcia w biodrach i kolanach.
4. Schodź do poziomu poniżej równoległości ud z podłogą, pilnując by kolana podążały w linii palców stóp.
5. Wyjdź w górę dynamicznie, pchając podłogę przez całe stopy.
`;
      await this.app.vault.create(ex3Path, ex3Content);
    }

    // 6. Przykładowy Body Tracker
    const bodyTrackerPath = normalizePath(settings.bodyTrackerFile);
    if (!this.app.vault.getAbstractFileByPath(bodyTrackerPath)) {
      const bodyContent = `---
type: body-tracker
lastUpdated: 2026-09-01
---
# Pomiary ciała

| Data | Waga (kg) | Klatka (cm) | Ramię (cm) | Pas (cm) | Udo (cm) | Notatki |
|:----:|:---------:|:-----------:|:----------:|:--------:|:--------:|:-------:|
| 2026-09-01 | 82.0 | 108.0 | 39.0 | 84.0 | 61.0 | Pomiary początkowe |
`;
      await this.app.vault.create(bodyTrackerPath, bodyContent);
    }
  }
}
