export type ExerciseLayout = "ide" | "dropdown";
export type OutputType = "normal" | "stderr" | "raw" | "file";

export interface ExerciseFenceConfig {
  exercise: string;
  layout: ExerciseLayout;
  entrypoint?: string;
  "word-wrap": boolean;
}

export interface ExerciseFilePolicies {
  "hide-from-preview": string[];
  "exclude-from-quartz": string[];
}

export interface ExerciseOutputExample {
  label?: string;
  type: OutputType;
  "content-file"?: string;
  content?: string;
  file?: string;
  fallback?: string;
}

export interface ExerciseOutputAssociation {
  source: string;
  heading?: string;
  examples: ExerciseOutputExample[];
}

export interface ExerciseHighlightRange {
  lines: string;
  note?: string;
  accent?: string;
}

export interface ExerciseHighlight {
  source: string;
  ranges: ExerciseHighlightRange[];
}

export interface ExerciseAnnotation {
  source: string;
  line: number;
  text: string;
  "inject-into-export": boolean;
}

export interface ExerciseManifest {
  version: 1;
  files: ExerciseFilePolicies;
  preview: { "ignore-size-limit": boolean };
  outputs: ExerciseOutputAssociation[];
  highlights: ExerciseHighlight[];
  annotations: ExerciseAnnotation[];
}

export interface QuartzExerciserOptions {
  exerciseRoot: "assets/exercises";
  defaultPreviewLimitBytes: number;
}

export interface ExerciseViewerFile {
  path: string;
  basename: string;
  size: number;
  kind: "text" | "image" | "audio" | "video" | "pdf" | "binary" | "oversized";
  language?: string;
  content?: string;
  publicUrl?: string;
  mime?: string;
}

export interface ResolvedOutputExample extends ExerciseOutputExample {
  label: string;
  resolvedContent?: string;
  publicUrl?: string;
}

export interface ResolvedOutputAssociation {
  source: string;
  heading: string;
  examples: ResolvedOutputExample[];
}

export interface ExerciseViewerPayload {
  exercise: string;
  layout: ExerciseLayout;
  entrypoint: string;
  wordWrap: boolean;
  zipUrl: string;
  locale: "en" | "fi";
  files: ExerciseViewerFile[];
  outputs: ResolvedOutputAssociation[];
  highlights: ExerciseHighlight[];
  annotations: ExerciseAnnotation[];
}
