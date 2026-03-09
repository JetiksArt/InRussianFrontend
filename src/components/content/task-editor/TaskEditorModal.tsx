import React, {useMemo, useState} from "react";
import axios from "axios";
import styles from "./ContentEditor.module.css";
import type {
    TaskType,
    TaskBody,
    GapWithVariantModel,
    TextInputWithVariantModel,
    ListenAndSelectModel,
    ImageAndSelectModel,
    ConstructSentenceModel,
    SelectWordsModel,
    StressWordModel,
    TableRowModel,
    CreateTaskModelRequest,
    UpdateTaskModelRequest,
    TaskModel,
    ContentItem,
} from "./TaskModels";
import {axiosInstance} from "../../../instances/axiosInstance";
import {UntranslatableField} from "./UntranslatableField";
import {TaskTypesPicker} from "./components/TaskTypesPicker";
import {PairsEditor} from "./components/PairsEditor";
import {SentencesEditor} from "./components/SentencesEditor";
import {AudioPairsEditor, ImagePairsEditor} from "./components/mediaPairEditors";
import {TextWithVariantGapsEditor} from "./components/TextWithVariantGapsEditor";
import {ListenAndSelectEditor} from "./components/ListenAndSelectEditor";
import {ImageAndSelectEditor} from "./components/ImageAndSelectEditor";
import {ConstructSentenceEditor} from "./components/ConstructSentenceEditor";
import {SelectWordsEditor} from "./components/SelectWordsEditor";
import {ContentBlocksEditor} from "./components/ContentBlocksEditor";
import {SetTheStressEditor} from "./components/SetTheStressEditor";
import {TableTaskEditor} from "./components/TableTaskEditor";
import {
    uploadTaskBodyMediaIfNeeded,
    toInternalTaskBody,
    toWireTaskBody,
    type WireTaskBody,
} from "./taskBodyUtils";

const BODY_TYPE_OPTIONS: { value: TaskBody["type"]; label: string }[] = [
    {value: "TextConnectTask", label: "Текстовые варианты"},
    {value: "AudioTask", label: "Аудио варианты"},
    {value: "ImageTask", label: "Изображения и подписи"},
    {value: "TextInputTask", label: "Ввод текста (Пропуски)"},
    {value: "TextInputWithVariantTask", label: "Пропуски с вариантами"},
    {value: "ListenAndSelect", label: "Слушать и выбирать"},
    {value: "ImageAndSelect", label: "Смотреть и выбирать"},
    {value: "ConstructSentenceTask", label: "Собери предложение"},
    {value: "SelectWordsTask", label: "Выбор слов"},
    {value: "SetTheStressTask", label: "Поставьте ударение"},
    {value: "TableTask", label: "Таблица"},
    {value: "ContentBlocks", label: "Теория"},
];

const OVERLAY_STYLE: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
};

const MODAL_STYLE: React.CSSProperties = {
    background: "var(--color-bg)",
    borderRadius: 10,
    width: "min(960px, 94vw)",
    maxHeight: "90vh",
    overflow: "auto",
    padding: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

function withOneBasedStressIndex<T extends { taskBody?: unknown }>(req: T): T {
    const taskBody = req.taskBody as any;
    if (!taskBody || taskBody.type !== "SetTheStressTask" || !Array.isArray(taskBody.task)) {
        return req;
    }
    return {
        ...req,
        taskBody: {
            ...taskBody,
            task: taskBody.task.map((item: any) => {
                const raw = Number.isFinite(item?.stressIndex) ? Math.trunc(Number(item.stressIndex)) : 0;
                return {
                    ...item,
                    stressIndex: Math.max(1, raw + 1),
                };
            }),
        },
    } as T;
}

async function createTaskApi(req: CreateTaskModelRequest): Promise<TaskModel> {
    try {
        const resp = await axiosInstance.post("/task", req);
        return resp.data as TaskModel;
    } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 400) {
            
            try {
                const fallbackArrayReq = {
                    ...req,
                    taskType: req.taskTypes,
                } as any;
                delete fallbackArrayReq.taskTypes;
                const resp = await axiosInstance.post("/task", fallbackArrayReq);
                return resp.data as TaskModel;
            } catch (fallbackArrayError: unknown) {
                if (axios.isAxiosError(fallbackArrayError) && fallbackArrayError.response?.status === 400) {
                    const fallbackStringReq: any = {
                        ...req,
                        taskType: req.taskTypes?.[0] ?? "",
                    };
                    delete fallbackStringReq.taskTypes;
                    try {
                        const resp = await axiosInstance.post("/task", fallbackStringReq);
                        return resp.data as TaskModel;
                    } catch (fallbackStringError: unknown) {
                        if (axios.isAxiosError(fallbackStringError) && fallbackStringError.response?.status === 400) {
                            const oneBasedReq = withOneBasedStressIndex(fallbackStringReq);
                            const resp = await axiosInstance.post("/task", oneBasedReq);
                            return resp.data as TaskModel;
                        }
                        throw fallbackStringError;
                    }
                }
                throw fallbackArrayError;
            }
        }
        throw e;
    }
}

async function updateTaskApi(id: string, req: UpdateTaskModelRequest): Promise<TaskModel> {
    try {
        const resp = await axiosInstance.put(`/task/${id}`, req);
        return resp.data as TaskModel;
    } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 400) {
            try {
                const fallbackArrayReq = {
                    ...req,
                    taskType: req.taskTypes,
                } as any;
                delete fallbackArrayReq.taskTypes;
                const resp = await axiosInstance.put(`/task/${id}`, fallbackArrayReq);
                return resp.data as TaskModel;
            } catch (fallbackArrayError: unknown) {
                if (axios.isAxiosError(fallbackArrayError) && fallbackArrayError.response?.status === 400) {
                    const fallbackStringReq: any = {
                        ...req,
                        taskType: req.taskTypes?.[0] ?? "",
                    };
                    delete fallbackStringReq.taskTypes;
                    try {
                        const resp = await axiosInstance.put(`/task/${id}`, fallbackStringReq);
                        return resp.data as TaskModel;
                    } catch (fallbackStringError: unknown) {
                        if (axios.isAxiosError(fallbackStringError) && fallbackStringError.response?.status === 400) {
                            const oneBasedReq = withOneBasedStressIndex(fallbackStringReq);
                            const resp = await axiosInstance.put(`/task/${id}`, oneBasedReq);
                            return resp.data as TaskModel;
                        }
                        throw fallbackStringError;
                    }
                }
                throw fallbackArrayError;
            }
        }
        throw e;
    }
}

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onCreated?: (task: TaskModel) => void;
    onUpdated?: (task: TaskModel) => void;
    themeId: string;
    initialTask?: TaskModel | null;
    readOnly?: boolean;
};

export default function TaskEditorModal({
    isOpen,
    onClose,
    onCreated,
    onUpdated,
    themeId,
    initialTask,
    readOnly = false,
}: Props) {
    const [question, setQuestion] = useState<string | null>("");
    const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [body, setBody] = useState<TaskBody>({type: "TextConnectTask", variant: [["", ""]]});

    const bodyType = body.type;

    React.useEffect(() => {
        if (!isOpen) return;
        if (!initialTask) {
            setQuestion("");
            setTaskTypes([]);
            setBody({type: "TextConnectTask", variant: [["", ""]]});
            return;
        }
        setQuestion(initialTask.question ?? "");
        setTaskTypes(initialTask.taskType ?? []);
        setBody(toInternalTaskBody(initialTask.taskBody as unknown as WireTaskBody));
    }, [isOpen, initialTask?.id]);

    const handleToggleTaskType = (taskType: TaskType) => {
        if (readOnly) return;
        setTaskTypes((prev) =>
            prev.includes(taskType) ? prev.filter((value) => value !== taskType) : [...prev, taskType],
        );
    };

    const handleChangeBodyType = (type: TaskBody["type"]) => {
        if (readOnly) return;
        switch (type) {
            case "TextConnectTask":
                setBody({type: "TextConnectTask", variant: [["", ""]]});
                setTaskTypes((prev) => (prev.length ? prev : ["TASK"]));
                break;
            case "TextInputTask":
                setBody({type: "TextInputTask", task: [{label: "", text: "", gaps: []}]});
                setTaskTypes((prev) => (prev.length ? prev : ["FILL"]));
                break;
            case "AudioTask":
                setBody({type: "AudioTask", variant: [["", ""]]});
                setTaskTypes((prev) => (prev.length ? prev : ["CONNECT_AUDIO"]));
                break;
            case "ImageTask":
                setBody({type: "ImageTask", variant: [["", ""]]});
                setTaskTypes((prev) => (prev.length ? prev : ["CONNECT_IMAGE"]));
                break;
            case "TextInputWithVariantTask":
                setBody({type: "TextInputWithVariantTask", task: {label: "", text: "", gaps: []}} as TaskBody);
                setTaskTypes((prev) => (prev.length ? prev : ["FILL"]));
                break;
            case "ListenAndSelect":
                setBody({
                    type: "ListenAndSelect",
                    task: {audioBlocks: [], variants: [["", false], ["", false]]},
                } as TaskBody);
                setTaskTypes((prev) => (prev.length ? prev : ["LISTEN"]));
                break;
            case "ImageAndSelect":
                setBody({
                    type: "ImageAndSelect",
                    task: {imageBlocks: [], variants: [["", false], ["", false]]},
                } as TaskBody);
                setTaskTypes((prev) => (prev.length ? prev : ["SELECT"]));
                break;
            case "ConstructSentenceTask":
                setBody({type: "ConstructSentenceTask", task: {audio: null, variants: ["", ""]}} as TaskBody);
                setTaskTypes((prev) => (prev.length ? prev : ["TASK"]));
                break;
            case "SelectWordsTask":
                setBody({
                    type: "SelectWordsTask",
                    task: {audio: "", variants: [["", false], ["", false]]},
                } as TaskBody);
                setTaskTypes((prev) => (prev.length ? prev : ["MARK"]));
                break;
            case "SetTheStressTask":
                setBody({type: "SetTheStressTask", task: [{word: "", stressIndex: 0}]});
                setTaskTypes(["SET_THE_STRESS"]);
                break;
            case "TableTask":
                setBody({
                    type: "TableTask",
                    task: [{cells: [{type: "READONLY", value: ""}, {type: "WRITABLE", value: "", answer: ""}]}],
                } as TaskBody);
                setTaskTypes(["TASK"]);
                break;
            case "ContentBlocks":
                setBody({type: "ContentBlocks", items: [{kind: "TEXT", text: ""}]});
                setTaskTypes(["CONTENT_BLOCKS"]);
                break;
        }
    };

    const getNormalizedTaskTypes = (types: TaskType[], bodyType: TaskBody["type"]): TaskType[] => {
        if (bodyType === "SetTheStressTask") return ["SET_THE_STRESS"];
        if (bodyType === "ContentBlocks") return ["CONTENT_BLOCKS"];
        if (bodyType === "TableTask") return ["TASK"];
        return types;
    };

    const submitDisabled = useMemo(() => {
        const isCreate = !initialTask;
        if (taskTypes.length === 0) return true;
        if (isCreate && (!question || question.trim() === "")) return true;
        switch (body.type) {
            case "TextConnectTask":
                return body.variant.length === 0 || body.variant.some(([a, b]) => !a || !b);
            case "AudioTask":
                return body.variant.length === 0 || body.variant.some(([audio, text]) => !audio || !text || !text.trim());
            case "ImageTask":
                return body.variant.length === 0 || body.variant.some(([image, caption]) => !image || !caption || !caption.trim());
            case "TextInputTask":
                return (
                    body.task.length === 0 ||
                    body.task.some((sentence) => !sentence.text || !sentence.text.trim()) ||
                    body.task.some((sentence) => sentence.gaps.some((gap) => !gap.correctWord || gap.indexWord < 0)) ||
                    body.task.some((sentence) => {
                        const idxs = sentence.gaps.map((gap) => gap.indexWord);
                        return new Set(idxs).size !== idxs.length;
                    })
                );
            case "TextInputWithVariantTask":
                return (
                    !body.task ||
                    !body.task.text ||
                    !body.task.text.trim() ||
                    !body.task.gaps ||
                    body.task.gaps.some(
                        (gap: GapWithVariantModel) =>
                            (gap as any).indexWord < 0 ||
                            !gap.correctVariant ||
                            !gap.correctVariant.trim() ||
                            !gap.variants ||
                            gap.variants.length === 0 ||
                            gap.variants.some((variant) => !variant || !variant.trim()) ||
                            !gap.variants.includes(gap.correctVariant),
                    ) ||
                    (() => {
                        const idxs = body.task.gaps.map((gap: any) => gap.indexWord);
                        return new Set(idxs).size !== idxs.length;
                    })()
                );
            case "ListenAndSelect":
                return (
                    !(body.task as ListenAndSelectModel).audioBlocks?.length ||
                    (body.task as ListenAndSelectModel).audioBlocks.some((block) => !block.name || !block.audio) ||
                    !(body.task as ListenAndSelectModel).variants ||
                    (body.task as ListenAndSelectModel).variants.length < 2 ||
                    (body.task as ListenAndSelectModel).variants.some(([text]) => !text || !text.trim()) ||
                    !(body.task as ListenAndSelectModel).variants.some(([, correct]) => correct)
                );
            case "ImageAndSelect":
                return (
                    !(body.task as ImageAndSelectModel).imageBlocks?.length ||
                    (body.task as ImageAndSelectModel).imageBlocks.some((block) => !block.name || !block.image) ||
                    !(body.task as ImageAndSelectModel).variants ||
                    (body.task as ImageAndSelectModel).variants.length < 2 ||
                    (body.task as ImageAndSelectModel).variants.some(([text]) => !text || !text.trim()) ||
                    !(body.task as ImageAndSelectModel).variants.some(([, correct]) => correct)
                );
            case "ConstructSentenceTask":
                return (
                    !(body.task as ConstructSentenceModel).variants ||
                    (body.task as ConstructSentenceModel).variants.length < 2 ||
                    (body.task as ConstructSentenceModel).variants.some((word) => !word || !word.trim())
                );
            case "SelectWordsTask":
                return (
                    !(body.task as SelectWordsModel).audio ||
                    !(body.task as SelectWordsModel).audio.trim() ||
                    (body.task as SelectWordsModel).variants.length < 2 ||
                    (body.task as SelectWordsModel).variants.some(([text]) => !text || !text.trim()) ||
                    !(body.task as SelectWordsModel).variants.some(([, correct]) => correct)
                );
            case "SetTheStressTask":
                return (
                    !(body.task as StressWordModel[]).length ||
                    (body.task as StressWordModel[]).some((w) => !w.word || !w.word.trim()) ||
                    (body.task as StressWordModel[]).some((w) => w.stressIndex < 0 || w.stressIndex >= (w.word || "").length)
                );
            case "TableTask":
                return (
                    !(body.task as TableRowModel[]).length ||
                    (body.task as TableRowModel[]).some((row) => !row.cells || row.cells.length < 2) ||
                    (body.task as TableRowModel[]).some((row) => row.cells.some((cell) => !cell.value || !cell.value.trim())) ||
                    (body.task as TableRowModel[]).some((row) =>
                        row.cells.some((cell) => cell.type === "WRITABLE" && (!cell.answer || !String(cell.answer).trim()))
                    )
                );
            case "ContentBlocks": {
                const items = (body as any).items as ContentItem[];
                if (!items || items.length === 0) return true;
                return items.some((item) => {
                    if (item.kind === "TEXT") return !item.text || !item.text.trim();
                    if (item.kind === "IMAGE") return !item.imageUrl || !item.imageUrl.trim();
                    if (item.kind === "AUDIO") return !item.audioUrl || !item.audioUrl.trim();
                    return true;
                });
            }
            default:
                return true;
        }
    }, [taskTypes, body, initialTask, question]);

    const onSubmit = async () => {
        setError(null);
        setSaving(true);
        try {
            const bodyWithMediaIds = await uploadTaskBodyMediaIfNeeded(body);
            const wireBody = toWireTaskBody(bodyWithMediaIds);
            const normalizedTaskTypes = getNormalizedTaskTypes(taskTypes, body.type);
            if (initialTask) {
                const req: UpdateTaskModelRequest = {
                    themeId,
                    taskBody: wireBody as unknown as TaskBody,
                    taskTypes: normalizedTaskTypes,
                };
                const updated = await updateTaskApi(initialTask.id, req);
                onUpdated?.(updated);
                onClose();
            } else {
                const req: CreateTaskModelRequest = {
                    themeId,
                    taskBody: wireBody as unknown as TaskBody,
                    question: question === "" ? null : question,
                    taskTypes: normalizedTaskTypes,
                };
                const created = await createTaskApi(req);
                onCreated?.(created);
                onClose();
            }
        } catch (e: unknown) {
            if (axios.isAxiosError(e)) {
                const status = e.response?.status;
                const data = e.response?.data;
                const details =
                    typeof data === "string"
                        ? data
                        : data && typeof data === "object"
                            ? JSON.stringify(data)
                            : e.message;
                setError(`Ошибка ${status ?? ""}: ${details || "Не удалось создать задание"}`.trim());
                console.error("Task create/update failed:", {
                    status,
                    data,
                    request: e.config?.data,
                });
            } else {
                setError("Не удалось создать задание");
                console.error("Task create/update failed:", e);
            }
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={OVERLAY_STYLE} onClick={onClose}>
            <div style={MODAL_STYLE} onClick={(e) => e.stopPropagation()}>
                <div className={`${styles.header} ${styles.modalHeader}`}>
                    <h3 className={styles.title}>
                        {readOnly ? "Просмотр задания" : initialTask ? "Редактировать задание" : "Создать задание"}
                    </h3>
                </div>

                {error && (
                    <div className={styles.card} style={{borderColor: "#dc3545", color: "#dc3545"}}>
                        {error}
                    </div>
                )}

                <div className={styles.card}>
                    <div className={styles.fieldsGrid}>
                        <label className={styles.label}>
                            Вопрос
                            <UntranslatableField
                                className={styles.input}
                                value={question ?? ""}
                                onChange={(v) => setQuestion(v)}
                                placeholder="Вопрос..."
                                disabled={readOnly}
                            />
                        </label>

                        <label className={styles.label}>
                            Тип задания
                            <select
                                className={styles.input}
                                value={bodyType}
                                onChange={(e) => handleChangeBodyType(e.target.value as TaskBody["type"])}
                                disabled={readOnly}
                            >
                                {BODY_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                </div>

                <TaskTypesPicker selected={taskTypes} onToggle={handleToggleTaskType} disabled={readOnly} />

                <div className={styles.card}>
                    {body.type === "TextConnectTask" && (
                        <PairsEditor
                            title="Текстовые варианты"
                            pairs={body.variant}
                            onChange={(pairs) => setBody({...body, variant: pairs})}
                            leftPlaceholder="Текст"
                            rightPlaceholder="Перевод"
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "AudioTask" && (
                        <AudioPairsEditor
                            pairs={body.variant}
                            onChange={(pairs) => setBody({...body, variant: pairs})}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "ImageTask" && (
                        <ImagePairsEditor
                            pairs={body.variant}
                            onChange={(pairs) => setBody({...body, variant: pairs})}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "TextInputWithVariantTask" && (
                        <TextWithVariantGapsEditor
                            value={body.task as TextInputWithVariantModel}
                            onChange={(value: TextInputWithVariantModel) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "ListenAndSelect" && (
                        <ListenAndSelectEditor
                            value={body.task as ListenAndSelectModel}
                            onChange={(value: ListenAndSelectModel) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "ImageAndSelect" && (
                        <ImageAndSelectEditor
                            value={body.task as ImageAndSelectModel}
                            onChange={(value: ImageAndSelectModel) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "TextInputTask" && (
                        <SentencesEditor
                            sentences={body.task}
                            onChange={(sentences) => setBody({...body, task: sentences})}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "ConstructSentenceTask" && (
                        <ConstructSentenceEditor
                            value={body.task as ConstructSentenceModel}
                            onChange={(value: ConstructSentenceModel) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "SelectWordsTask" && (
                        <SelectWordsEditor
                            value={body.task as SelectWordsModel}
                            onChange={(value: SelectWordsModel) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "SetTheStressTask" && (
                        <SetTheStressEditor
                            value={body.task as StressWordModel[]}
                            onChange={(value: StressWordModel[]) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "TableTask" && (
                        <TableTaskEditor
                            value={body.task as TableRowModel[]}
                            onChange={(value: TableRowModel[]) => setBody({...body, task: value} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}

                    {body.type === "ContentBlocks" && (
                        <ContentBlocksEditor
                            value={{items: (body as any).items || []}}
                            onChange={(value) => setBody({type: "ContentBlocks", items: value.items} as TaskBody)}
                            disabled={readOnly}
                        />
                    )}
                </div>

                <div className={styles.modalFooter}>
                    <div style={{flex: 1}} />
                    <button className={styles.actionButton} onClick={onClose} disabled={saving}>
                        Закрыть
                    </button>
                    {!readOnly && (
                        <button
                            className={styles.actionButton}
                            onClick={onSubmit}
                            disabled={saving || submitDisabled}
                        >
                            {saving ? (initialTask ? "Сохранение..." : "Создание...") : initialTask ? "Сохранить" : "Создать"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
