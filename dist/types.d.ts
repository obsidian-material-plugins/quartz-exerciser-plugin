type ExerciseLayout = "ide" | "dropdown";
type OutputType = "normal" | "stderr" | "raw" | "file";
interface ExerciseFenceConfig {
    exercise: string;
    layout: ExerciseLayout;
    entrypoint?: string;
    "word-wrap": boolean;
}
interface ExerciseFilePolicies {
    "hide-from-preview": string[];
    "exclude-from-quartz": string[];
}
interface ExerciseOutputExample {
    label?: string;
    type: OutputType;
    "content-file"?: string;
    content?: string;
    file?: string;
    fallback?: string;
}
interface ExerciseOutputAssociation {
    source: string;
    heading?: string;
    examples: ExerciseOutputExample[];
}
interface ExerciseHighlightRange {
    lines: string;
    note?: string;
    accent?: string;
}
interface ExerciseHighlight {
    source: string;
    ranges: ExerciseHighlightRange[];
}
interface ExerciseAnnotation {
    source: string;
    line: number;
    text: string;
    "inject-into-export": boolean;
}
interface ExerciseManifest {
    version: 1;
    files: ExerciseFilePolicies;
    preview: {
        "ignore-size-limit": boolean;
    };
    outputs: ExerciseOutputAssociation[];
    highlights: ExerciseHighlight[];
    annotations: ExerciseAnnotation[];
}
interface QuartzExerciserOptions {
    exerciseRoot: "assets/exercises";
    defaultPreviewLimitBytes: number;
}
interface ExerciseViewerFile {
    path: string;
    basename: string;
    size: number;
    kind: "text" | "image" | "audio" | "video" | "pdf" | "binary" | "oversized";
    language?: string;
    content?: string;
    publicUrl?: string;
    mime?: string;
}
interface ResolvedOutputExample extends ExerciseOutputExample {
    label: string;
    resolvedContent?: string;
    publicUrl?: string;
}
interface ResolvedOutputAssociation {
    source: string;
    heading: string;
    examples: ResolvedOutputExample[];
}
interface ExerciseViewerPayload {
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

export type { ExerciseAnnotation, ExerciseFenceConfig, ExerciseFilePolicies, ExerciseHighlight, ExerciseHighlightRange, ExerciseLayout, ExerciseManifest, ExerciseOutputAssociation, ExerciseOutputExample, ExerciseViewerFile, ExerciseViewerPayload, OutputType, QuartzExerciserOptions, ResolvedOutputAssociation, ResolvedOutputExample };
