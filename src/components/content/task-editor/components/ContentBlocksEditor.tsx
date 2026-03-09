import React from "react";
import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import {FileInput} from "./FileInput";
import type {ContentItem, ContentKind} from "../TaskModels";
import {asDataUrl, fileToBase64, isBareBase64, isDataUrl} from "../mediaUtils";

export function ContentBlocksEditor({value, onChange, disabled}: {
    value: { items: ContentItem[] };
    onChange: (v: { items: ContentItem[] }) => void;
    disabled?: boolean;
}) {
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);

    const addItem = (kind: ContentKind) => {
        const base: ContentItem =
            kind === "TEXT"
                ? {kind, text: ""}
                : kind === "IMAGE"
                    ? {kind, imageUrl: "", caption: ""}
                    : {kind, audioUrl: "", caption: ""};
        onChange({items: [...value.items, base]});
    };

    const removeItem = (idx: number) => onChange({items: value.items.filter((_, i) => i !== idx)});

    const patchItem = (idx: number, patch: Partial<ContentItem>) =>
        onChange({items: value.items.map((it, i) => (i === idx ? {...it, ...patch} : it))});

    const moveItem = (from: number, to: number) => {
        if (from === to || from < 0 || to < 0) return;
        const items = [...value.items];
        const [moved] = items.splice(from, 1);
        items.splice(to, 0, moved);
        onChange({items});
    };

    const setFile = async (idx: number, file: File | null, kind: "image" | "audio") => {
        if (!file) return;
        const base64 = await fileToBase64(file);
        if (kind === "image") patchItem(idx, {imageUrl: base64});
        else patchItem(idx, {audioUrl: base64});
    };

    return (
        <div>
            <div className={styles.header}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Теория (контент блоки)
                </h4>
                {!disabled && (
                    <div style={{display: "flex", gap: 8, flexWrap: "wrap"}}>
                        <button className={styles.actionButton} onClick={() => addItem("TEXT")}>
                            + Текст
                        </button>
                        <button className={styles.actionButton} onClick={() => addItem("IMAGE")}>
                            + Изображение
                        </button>
                        <button className={styles.actionButton} onClick={() => addItem("AUDIO")}>
                            + Аудио
                        </button>
                    </div>
                )}
            </div>
            <div className={styles.list}>
                {value.items.map((item, i) => (
                    <div
                        key={i}
                        className={`${styles.card} ${dragIndex === i ? styles.draggingCard : ""}`}
                        style={{paddingLeft: disabled ? undefined : 42}}
                        draggable={!disabled}
                        onDragStart={(e) => {
                            if (disabled) return;
                            setDragIndex(i);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", String(i));
                        }}
                        onDragOver={(e) => {
                            if (disabled) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                        }}
                        onDrop={(e) => {
                            if (disabled) return;
                            e.preventDefault();
                            const from = Number(e.dataTransfer.getData("text/plain"));
                            moveItem(from, i);
                            setDragIndex(null);
                        }}
                        onDragEnd={() => setDragIndex(null)}
                    >
                        {!disabled && (
                            <div className={styles.dragHandle} title="Перетащите для изменения порядка">
                                ⋮⋮
                            </div>
                        )}
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeItem(i)}>
                                ✕ удалить
                            </button>
                        )}
                        {item.kind === "TEXT" && (
                            <div className={styles.fieldsGrid}>
                                <label className={styles.label}>
                                    Текст
                                    <RichTextEditor
                                        value={item.text || ""}
                                        onChange={(v) => patchItem(i, {text: v})}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                        )}
                        {item.kind === "IMAGE" && (
                            <div className={styles.fieldsGrid}>
                                <label className={styles.label}>
                                    URL изображения (или загрузите файл)
                                    <input
                                        className={styles.input}
                                        value={item.imageUrl || ""}
                                        onChange={(e) => patchItem(i, {imageUrl: e.target.value})}
                                        disabled={disabled}
                                    />
                                </label>
                                <FileInput
                                    label="Файл изображения"
                                    value={item.imageUrl}
                                    accept="image/*"
                                    onChange={(f) => setFile(i, f, "image")}
                                    disabled={disabled}
                                />
                                <label className={styles.label}>
                                    Подпись
                                    <RichTextEditor
                                        value={item.caption || ""}
                                        onChange={(v) => patchItem(i, {caption: v})}
                                        disabled={disabled}
                                    />
                                </label>
                                {item.imageUrl && (
                                    <div className={styles.mediaBlock}>
                                        <img
                                            className={styles.image}
                                            src={
                                                isDataUrl(item.imageUrl) || isBareBase64(item.imageUrl)
                                                    ? asDataUrl(item.imageUrl, "image/*")
                                                    : item.imageUrl
                                            }
                                            alt=""
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {item.kind === "AUDIO" && (
                            <div className={styles.fieldsGrid}>
                                <label className={styles.label}>
                                    URL аудио (или загрузите файл)
                                    <input
                                        className={styles.input}
                                        value={item.audioUrl || ""}
                                        onChange={(e) => patchItem(i, {audioUrl: e.target.value})}
                                        disabled={disabled}
                                    />
                                </label>
                                <FileInput
                                    label="Файл аудио"
                                    value={item.audioUrl}
                                    accept="audio/*"
                                    onChange={(f) => setFile(i, f, "audio")}
                                    disabled={disabled}
                                />
                                <label className={styles.label}>
                                    Подпись
                                    <RichTextEditor
                                        value={item.caption || ""}
                                        onChange={(v) => patchItem(i, {caption: v})}
                                        disabled={disabled}
                                    />
                                </label>
                                {item.audioUrl && (
                                    <div className={styles.mediaBlock}>
                                        <audio
                                            className={styles.audio}
                                            controls
                                            src={
                                                isDataUrl(item.audioUrl) || isBareBase64(item.audioUrl)
                                                    ? asDataUrl(item.audioUrl, "audio/*")
                                                    : item.audioUrl || undefined
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
