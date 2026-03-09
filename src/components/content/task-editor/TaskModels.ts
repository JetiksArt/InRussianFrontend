export type TaskType =
    | "WRITE"
    | "LISTEN"
    | "READ"
    | "SPEAK"
    | "REPEAT"
    | "REMIND"
    | "MARK"
    | "FILL"
    | "CONNECT_AUDIO"
    | "CONNECT_IMAGE"
    | "CONNECT_TRANSLATE"
    | "SELECT"
    | "TASK"
    | "QUESTION"
    | "SET_THE_STRESS"
    | "CONTENT_BLOCKS";

export type Pair<A, B> = [A, B];

export interface Gap {
    correctWord: string;
    indexWord: number; // internal; maps to backend indexWord
}

type TaskBodyWithType = Extract<TaskBody, { type: string }>;
const hasType = (body: TaskBody): body is TaskBodyWithType => "type" in body;

export interface Sentence {
    label: string;
    text: string;
    gaps: Gap[];
}

export interface GapWithVariantModel {
    indexWord: number; // matches backend indexWord
    variants: string[];
    correctVariant: string;
}

export interface TextInputWithVariantModel {
    label: string;
    text: string;
    gaps: GapWithVariantModel[];
}

export interface AudioBlocks {
    name: string;
    description?: string | null;
    audio: string; // mediaId | dataURL | base64
    descriptionTranslate?: string | null;
}

export interface ListenAndSelectModel {
    audioBlocks: AudioBlocks[];
    variants: Pair<string, boolean>[];
}

export interface ImageBlocks {
    name: string;
    description?: string | null;
    image: string; // mediaId | dataURL | base64
    descriptionTranslate?: string | null;
}

export interface ImageAndSelectModel {
    imageBlocks: ImageBlocks[];
    variants: Pair<string, boolean>[];
}

export interface ConstructSentenceModel {
    audio?: string | null; // mediaId | dataURL | base64
    variants: string[]; // words in correct order
}

export interface SelectWordsModel {
    audio: string; // mediaId | dataURL | base64 (required)
    variants: Pair<string, boolean>[]; // single correct (radio)
}

export interface StressWordModel {
    word: string;
    stressIndex: number;
}

export type TableCellType = "READONLY" | "WRITABLE";

export interface TableCellModel {
    type: TableCellType;
    value: string;
    answer?: string | null;
}

export interface TableRowModel {
    cells: TableCellModel[];
}

// New: Theory (ContentBlocks)
export type ContentKind = "TEXT" | "IMAGE" | "AUDIO";

export interface ContentItem {
    kind: ContentKind;
    text?: string | null;
    imageUrl?: string | null;
    audioUrl?: string | null;
    caption?: string | null;
}

export type TaskBody =
    | {
    type: "TextConnectTask";
    variant: Pair<string, string>[];
}
    | {
    type: "AudioTask";
    variant: Pair<string, string>[];
}
    | {
    type: "ImageTask";
    variant: Pair<string, string>[];
}
    | {
    type: "TextInputTask";
    task: Sentence[];
}
    | {
    type: "TextInputWithVariantTask";
    task: TextInputWithVariantModel;
}
    | {
    type: "ListenAndSelect";
    task: ListenAndSelectModel;
}
    | {
    type: "ImageAndSelect";
    task: ImageAndSelectModel;
}
    | {
    type: "ConstructSentenceTask";
    task: ConstructSentenceModel;
}
    | {
    type: "SelectWordsTask";
    task: SelectWordsModel;
}
    | {
    type: "SetTheStressTask";
    task: StressWordModel[];
}
    | {
    type: "TableTask";
    task: TableRowModel[];
}
    | {
    type: "ContentBlocks";
    items: ContentItem[];
};

export interface TaskModel {
    id: string;
    taskType: TaskType[];
    taskBody: TaskBody;
    question: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaskModelRequest {
    themeId: string;
    taskBody: TaskBody;
    question: string | null;
    taskTypes: TaskType[];
}

export interface UpdateTaskModelRequest {
    themeId: string;
    taskBody: TaskBody;
    taskTypes: TaskType[];
}


export const isTextTask = (_b: TaskBody): _b is never => false;
export const isAudioTask = (b: TaskBody): b is Extract<TaskBody, { type: "AudioTask" }> =>
    hasType(b) && b.type === "AudioTask";

export const isImageTask = (b: TaskBody): b is Extract<TaskBody, { type: "ImageTask" }> =>
    hasType(b) && b.type === "ImageTask";
export const isTextInputTask = (b: TaskBody): b is Extract<TaskBody, { type: "TextInputTask" }> =>
    b.type === "TextInputTask";
export const isTextInputWithVariantTask = (
    b: TaskBody
): b is Extract<TaskBody, { type: "TextInputWithVariantTask" }> => b.type === "TextInputWithVariantTask";

export const TASK_TYPE_LABELS_RU: Record<TaskType, string> = {
    WRITE: "Пишите",
    LISTEN: "Слушайте",
    READ: "Читайте",
    SPEAK: "Говорите",
    REPEAT: "Повторяйте",
    REMIND: "Запоминайте",
    MARK: "Выберите правильные слова",
    FILL: "Заполните пропуски",
    CONNECT_AUDIO: "Соедините аудио с переводом",
    CONNECT_IMAGE: "Соедините изображение с текстом",
    CONNECT_TRANSLATE: "Соедините перевод со словом",
    SELECT: "Выберите правильный вариант",
    TASK: "Задание",
    QUESTION: "Что это?",
    SET_THE_STRESS: "Поставьте ударение",
    CONTENT_BLOCKS: "Theory",
};

export const taskTypeToRu = (t: TaskType): string => TASK_TYPE_LABELS_RU[t];

export const taskTypesToRu = (types: TaskType[], separator = ", "): string =>
    types.map(taskTypeToRu).join(separator);
