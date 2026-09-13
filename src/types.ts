export interface WorkoutSet {
  id: string;
  setNumber: number;
  previousKg?: number;
  previousReps?: number;
  kg: number | null;
  reps: number | null;
  completed: boolean;
  rpe?: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseName: string;
  muscleGroup?: string;
  secondaryMuscles?: string[];
  coverPath?: string;
  defaultRestSeconds: number;
  sets: WorkoutSet[];
}

export interface ActiveWorkout {
  id: string;
  templateName: string;
  startTime: number;
  endTime?: number;
  exercises: WorkoutExercise[];
  activeRestTimer?: {
    targetTimestamp: number;
    totalSeconds: number;
    exerciseName?: string;
  } | null;
  notes?: string;
}

export interface WorkoutTemplateExercise {
  name: string;
  sets: number;
  targetReps?: string;
  defaultWeight?: number;
  defaultRest?: number;
}

export interface WorkoutTemplate {
  name: string;
  filePath: string;
  defaultRestSeconds: number;
  exercises: WorkoutTemplateExercise[];
  notes?: string;
}

export interface ExerciseMeta {
  name: string;
  filePath: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  cover: string;
  defaultRest: number;
  content: string;
}

export interface BodyMeasurementEntry {
  date: string;
  weight?: number;
  chest?: number;
  arm?: number;
  waist?: number;
  thigh?: number;
  notes?: string;
}

export interface WorkoutTrackerSettings {
  templatesFolder: string;
  exercisesFolder: string;
  logsFolder: string;
  bodyTrackerFile: string;
  defaultRestSeconds: number;
  enableVibration: boolean;
  enableSound: boolean;
  enableNotifications: boolean;
  vibrationPattern: number[];
}

export const DEFAULT_SETTINGS: WorkoutTrackerSettings = {
  templatesFolder: "Workouts/Templates",
  exercisesFolder: "Workouts/Exercises",
  logsFolder: "Workouts/Logs",
  bodyTrackerFile: "Workouts/Body Tracker.md",
  defaultRestSeconds: 90,
  enableVibration: true,
  enableSound: true,
  enableNotifications: true,
  vibrationPattern: [250, 100, 250],
};
