import React from "react";
import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import {FileInput} from "./FileInput";
import type {ListenAndSelectModel} from "../TaskModels";
import {asDataUrl, fileToBase64, getMediaUrlById, isBareBase64, isDataUrl} from "../mediaUtils";

export function ListenAndSelectEditor({
    value,
    onChange,
    disabled,
}: {
    value: ListenAndSelectModel;
    onChange: (v: ListenAndSelectModel) => void;
    disabled?: boolean;
}) {
    const [previews, setPreviews] = React.useState<(string | null)[]>([]);
    React.useEffect(() => {
        let active = true;
        const urlsToRevoke: string[] = [];
        (async () => {
            const res = await Promise.all(
                value.audioBlocks.map(async (block) => {
                    const audio = block.audio;
                    if (isDataUrl(audio)) return audio;
                    if (isBareBase64(audio)) return asDataUrl(audio, "audio/*");
                    if (/^https?:\/\//i.test(audio)) return audio;
                    const url = await getMediaUrlById(audio);
                    if (url) urlsToRevoke.push(url);
                    return url;
                })
            );
            if (active) setPreviews(res);
        })();
        return () => {
            active = false;
            urlsToRevoke.forEach((url) => url && URL.revokeObjectURL(url));
        };
    }, [value.audioBlocks]);

    const addBlock = () =>
        onChange({
            ...value,
            audioBlocks: [
                ...value.audioBlocks,
                {name: "", description: "", audio: "", descriptionTranslate: ""},
            ],
        });

    const removeBlock = (idx: number) =>
        onChange({...value, audioBlocks: value.audioBlocks.filter((_, i) => i !== idx)});

    const updateBlock = (idx: number, patch: Partial<ListenAndSelectModel["audioBlocks"][number]>) =>
        onChange({
            ...value,
            audioBlocks: value.audioBlocks.map((block, i) => (i === idx ? {...block, ...patch} : block)),
        });

    const setAudio = async (idx: number, file: File | null) => {
        if (!file) return;
        const base64 = await fileToBase64(file);
        updateBlock(idx, {audio: base64});
    };

    const setAudioUrl = (idx: number, audio: string) => {
        updateBlock(idx, {audio});
    };

    const setVariantText = (idx: number, text: string) =>
        onChange({...value, variants: value.variants.map((variant, i) => (i === idx ? [text, variant[1]] : variant))});

    const setOnlyCorrect = (idx: number) =>
        onChange({...value, variants: value.variants.map((variant, i) => [variant[0], i === idx])});

    const addVariant = () => onChange({...value, variants: [...value.variants, ["", false]]});
    const removeVariant = (idx: number) => onChange({...value, variants: value.variants.filter((_, i) => i !== idx)});

    return (
        <div>
            <div className={`${styles.header} ${styles.stickyToolbar}`}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Слушать и выбирать
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addBlock}>
                        Добавить блок
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {value.audioBlocks.map((block, i) => (
                    <div key={i} className={styles.card}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeBlock(i)}>
                                ✕ удалить
                            </button>
                        )}
                        <div className={styles.fieldsGrid}>
                            <label className={styles.label}>
                                Название
                                <RichTextEditor
                                    value={block.name}
                                    onChange={(v) => updateBlock(i, {name: v})}
                                    disabled={disabled}
                                />
                            </label>
                            <label className={styles.label}>
                                Описание
                                <RichTextEditor
                                    value={block.description ?? ""}
                                    onChange={(v) => updateBlock(i, {description: v})}
                                    disabled={disabled}
                                />
                            </label>
                            <label className={styles.label}>
                                Перевод описания
                                <RichTextEditor
                                    value={block.descriptionTranslate ?? ""}
                                    onChange={(v) => updateBlock(i, {descriptionTranslate: v})}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className={styles.mediaBlock}>
                            {previews[i] ? (
                                <audio className={styles.audio} controls src={previews[i] || undefined}/>
                            ) : (
                                <div className={styles.label}>
                                    {block.audio ? `аудио загружено (id: ${block.audio})` : "аудио не выбрано"}
                                </div>
                            )}
                        </div>
                        <FileInput
                            label="Аудио"
                            value={block.audio}
                            accept="audio/*"
                            onChange={(f) => setAudio(i, f)}
                            onValueChange={(audio) => setAudioUrl(i, audio)}
                            urlPlaceholder="https://example.com/audio.mp3"
                            disabled={disabled}
                        />
                    </div>
                ))}
            </div>
            <div className={`${styles.header} ${styles.stickyToolbar}`} style={{marginTop: 8}}>
                <h4 className={styles.title} style={{fontSize: "0.95rem"}}>
                    Варианты ответа
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addVariant}>
                        Добавить вариант
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {value.variants.map(([text, correct], i) => (
                    <div key={i} className={styles.card}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeVariant(i)}>
                                ✕ удалить
                            </button>
                        )}
                        <div className={styles.fieldsGrid}>
                            <label className={styles.label}>
                                Текст
                                <RichTextEditor
                                    value={text}
                                    onChange={(v) => setVariantText(i, v)}
                                    disabled={disabled}
                                />
                            </label>
                            <div className={styles.label} style={{display: "flex", alignItems: "center", gap: 8}}>
                                <input
                                    type="radio"
                                    name="listen-correct"
                                    checked={correct}
                                    onChange={() => setOnlyCorrect(i)}
                                    disabled={disabled}
                                />
                                <span>Правильный</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

