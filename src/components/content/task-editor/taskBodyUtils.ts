import type {
    TaskBody,
    Pair,
    Sentence,
    TextInputWithVariantModel,
    ListenAndSelectModel,
    ImageAndSelectModel,
    ConstructSentenceModel,
    SelectWordsModel,
    StressWordModel,
    ContentItem,
    TableRowModel,
} from "./TaskModels";
import {isBareBase64, isDataUrl, uploadMediaString} from "./mediaUtils";

const OPEN_TAG = "<translatable>";
const CLOSE_TAG = "</translatable>";
const stripTranslatableTags = (word: string) =>
    (word || "").replaceAll(OPEN_TAG, "").replaceAll(CLOSE_TAG, "");

export type PairObj<A, B> = { first: A; second: B };

export type WireTaskBody =
    | { type: "TextConnectTask"; variant: PairObj<string, string>[] }
    | { type: "AudioTask"; variant: PairObj<string, string>[] }
    | { type: "TextInputTask"; task: Sentence[] }
    | { type: "TextInputWithVariantTask"; task: TextInputWithVariantModel }
    | { type: "ImageTask"; variant: PairObj<string, string>[] }
    | {
        type: "ListenAndSelect";
        task: { audioBlocks: ListenAndSelectModel["audioBlocks"]; variants: PairObj<string, boolean>[] };
    }
    | {
        type: "ImageAndSelect";
        task: { imageBlocks: ImageAndSelectModel["imageBlocks"]; variants: PairObj<string, boolean>[] };
    }
    | { type: "ConstructSentenceTask"; task: { audio: string | null; variants: string[] } }
    | { type: "SelectWordsTask"; task: { audio: string; variants: PairObj<string, boolean>[] } }
    | { type: "SetTheStressTask"; task: StressWordModel[] }
    | { type: "TableTask"; task: TableRowModel[] }
    | { type: "ContentBlocks"; items: ContentItem[] };

async function uploadPairsIfNeeded(
    pairs: Pair<string, string>[],
    kind: "audio" | "image",
): Promise<Pair<string, string>[]> {
    return Promise.all(
        pairs.map(async ([media, text]) => {
            if (media && (isDataUrl(media) || isBareBase64(media))) {
                const mediaId = await uploadMediaString(media, kind);
                return [mediaId, text] as Pair<string, string>;
            }
            return [media, text] as Pair<string, string>;
        })
    );
}

export async function uploadTaskBodyMediaIfNeeded(body: TaskBody): Promise<TaskBody> {
    if (body.type === "ListenAndSelect") {
        const nextBlocks = await Promise.all(
            body.task.audioBlocks.map(async (b) => ({
                ...b,
                audio: await uploadMediaString(b.audio, "audio"),
            }))
        );
        return {...body, task: {...body.task, audioBlocks: nextBlocks}} as TaskBody;
    }
    if (body.type === "ImageAndSelect") {
        const nextBlocks = await Promise.all(
            body.task.imageBlocks.map(async (b) => ({
                ...b,
                image: await uploadMediaString(b.image, "image"),
            }))
        );
        return {...body, task: {...body.task, imageBlocks: nextBlocks}} as TaskBody;
    }
    if (body.type === "ConstructSentenceTask") {
        if (body.task.audio && (isDataUrl(body.task.audio) || isBareBase64(body.task.audio))) {
            const mediaId = await uploadMediaString(body.task.audio, "audio");
            return {...body, task: {...body.task, audio: mediaId}} as TaskBody;
        }
        return body;
    }
    if (body.type === "SelectWordsTask") {
        if (body.task.audio && (isDataUrl(body.task.audio) || isBareBase64(body.task.audio))) {
            const mediaId = await uploadMediaString(body.task.audio, "audio");
            return {...body, task: {...body.task, audio: mediaId}} as TaskBody;
        }
        return body;
    }
    if (body.type === "ContentBlocks") {
        const items = await Promise.all(
            body.items.map(async (it) => {
                if (it.kind === "IMAGE" && it.imageUrl) {
                    const val = it.imageUrl;
                    if (isDataUrl(val) || isBareBase64(val)) {
                        const mediaId = await uploadMediaString(val, "image");
                        return {...it, imageUrl: mediaId} as ContentItem;
                    }
                }
                if (it.kind === "AUDIO" && it.audioUrl) {
                    const val = it.audioUrl;
                    if (isDataUrl(val) || isBareBase64(val)) {
                        const mediaId = await uploadMediaString(val, "audio");
                        return {...it, audioUrl: mediaId} as ContentItem;
                    }
                }
                return it;
            })
        );
        return {...body, items} as TaskBody;
    }
    if (body.type === "AudioTask") {
        const variant = await uploadPairsIfNeeded(body.variant, "audio");
        return {...body, variant} as TaskBody;
    }
    if (body.type === "ImageTask") {
        const variant = await uploadPairsIfNeeded(body.variant, "image");
        return {...body, variant} as TaskBody;
    }
    return body;
}

export function toInternalTaskBody(wire: WireTaskBody): TaskBody {
    switch (wire.type) {
        case "TextConnectTask":
            return {type: "TextConnectTask", variant: wire.variant.map((p) => [p.first, p.second])};
        case "AudioTask":
            return {type: "AudioTask", variant: wire.variant.map((p) => [p.first, p.second])};
        case "ImageTask":
            return {type: "ImageTask", variant: wire.variant.map((p) => [p.first, p.second])};
        case "TextInputTask":
            return {
                type: "TextInputTask",
                task: (wire as any).task.map((s: any) => ({
                    ...s,
                    gaps: (s.gaps || []).map((g: any) => ({
                        ...g,
                        indexWord: g.indexWord ?? g.index ?? 0,
                    })),
                })),
            } as TaskBody;
        case "TextInputWithVariantTask":
            return {
                type: "TextInputWithVariantTask",
                task: {
                    ...wire.task,
                    gaps: (wire.task.gaps ?? []).map((g: any) => ({
                        indexWord: g.indexWord ?? g.index ?? 0,
                        variants: g.variants ?? [],
                        correctVariant: g.correctVariant ?? "",
                    })),
                },
            } as TaskBody;
        case "ListenAndSelect":
            return {
                type: "ListenAndSelect",
                task: {
                    audioBlocks: wire.task.audioBlocks,
                    variants: wire.task.variants.map((v) => [v.first, v.second]) as [string, boolean][],
                },
            } as TaskBody;
        case "ImageAndSelect":
            return {
                type: "ImageAndSelect",
                task: {
                    imageBlocks: wire.task.imageBlocks,
                    variants: wire.task.variants.map((v) => [v.first, v.second]) as [string, boolean][],
                },
            } as TaskBody;
        case "ConstructSentenceTask":
            return {
                type: "ConstructSentenceTask",
                task: {audio: (wire as any).task.audio ?? null, variants: (wire as any).task.variants || []},
            } as TaskBody;
        case "SelectWordsTask":
            return {
                type: "SelectWordsTask",
                task: {
                    audio: (wire as any).task.audio || "",
                    variants: (wire as any).task.variants?.map((v: any) => [v.first, v.second]) || [],
                },
            } as TaskBody;
        case "SetTheStressTask":
            return {
                type: "SetTheStressTask",
                task: ((wire as any).task || []).map((w: any) => ({
                    word: w.word || "",
                    stressIndex: Number.isFinite(w.stressIndex) ? w.stressIndex : 0,
                })),
            } as TaskBody;
        case "TableTask":
            return {
                type: "TableTask",
                task: ((wire as any).task || []).map((row: any) => ({
                    cells: (row?.cells || []).map((cell: any) => ({
                        type: cell?.type === "WRITABLE" ? "WRITABLE" : "READONLY",
                        value: cell?.value ?? "",
                        answer: cell?.answer ?? null,
                    })),
                })),
            } as TaskBody;
        case "ContentBlocks":
            return {type: "ContentBlocks", items: (wire as any).items || []} as TaskBody;
        default:
            return wire as unknown as TaskBody;
    }
}

export function toWireTaskBody(internal: TaskBody): WireTaskBody {
    switch (internal.type) {
        case "TextConnectTask":
            return {
                type: "TextConnectTask",
                variant: internal.variant.map(([a, b]) => ({first: a, second: b})),
            };
        case "TextInputWithVariantTask":
            return {
                type: "TextInputWithVariantTask",
                task: {
                    ...internal.task,
                    gaps: (internal.task as any).gaps.map((g: any) => ({
                        indexWord: g.indexWord,
                        variants: g.variants,
                        correctVariant: g.correctVariant,
                    })),
                },
            } as WireTaskBody;
        case "ListenAndSelect":
            return {
                type: "ListenAndSelect",
                task: {
                    audioBlocks: internal.task.audioBlocks,
                    variants: internal.task.variants.map(([t, c]) => ({first: t, second: c})),
                },
            } as WireTaskBody;
        case "ImageAndSelect":
            return {
                type: "ImageAndSelect",
                task: {
                    imageBlocks: internal.task.imageBlocks,
                    variants: internal.task.variants.map(([t, c]) => ({first: t, second: c})),
                },
            } as WireTaskBody;
        case "ConstructSentenceTask":
            return {
                type: "ConstructSentenceTask",
                task: {audio: internal.task.audio ?? null, variants: internal.task.variants},
            } as WireTaskBody;
        case "SelectWordsTask":
            return {
                type: "SelectWordsTask",
                task: {
                    audio: internal.task.audio,
                    variants: internal.task.variants.map(([t, c]) => ({first: t, second: c})),
                },
            } as WireTaskBody;
        case "SetTheStressTask":
            return {
                type: "SetTheStressTask",
                task: (internal.task || [])
                    .map((w) => {
                        const clean = stripTranslatableTags(w.word || "").trim();
                        const max = Math.max(0, clean.length - 1);
                        const raw = Number.isFinite(w.stressIndex) ? w.stressIndex : 0;
                        const idx = Math.trunc(raw);
                        return {
                            word: clean,
                            stressIndex: Math.min(Math.max(0, idx), max),
                        };
                    })
                    .filter((w) => w.word.length > 0),
            } as WireTaskBody;
        case "TableTask":
            return {
                type: "TableTask",
                task: (internal.task || []).map((row) => ({
                    cells: (row.cells || []).map((cell) => ({
                        type: cell.type === "WRITABLE" ? "WRITABLE" : "READONLY",
                        value: cell.value ?? "",
                        answer: cell.type === "WRITABLE" ? (cell.answer ?? "") : null,
                    })),
                })),
            } as WireTaskBody;
        case "ContentBlocks":
            return {type: "ContentBlocks", items: (internal as any).items} as WireTaskBody;
        case "AudioTask":
            return {
                type: "AudioTask",
                variant: internal.variant.map(([audio, text]) => ({first: audio, second: text})),
            };
        case "ImageTask":
            return {
                type: "ImageTask",
                variant: internal.variant.map(([image, caption]) => ({first: image, second: caption})),
            };
        default:
            return internal as unknown as WireTaskBody;
    }
}

