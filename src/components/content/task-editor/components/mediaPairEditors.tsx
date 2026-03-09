import React from "react";
import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import {FileInput} from "./FileInput";
import type {Pair} from "../TaskModels";
import {asDataUrl, fileToBase64, getMediaUrlById, isBareBase64, isDataUrl} from "../mediaUtils";

function useMediaPairPreviews(pairs: Pair<string, string>[], kind: "audio" | "image") {
    const [previews, setPreviews] = React.useState<(string | null)[]>([]);
    React.useEffect(() => {
        let active = true;
        const urlsToRevoke: string[] = [];
        (async () => {
            const res = await Promise.all(
                pairs.map(async ([val]) => {
                    if (isDataUrl(val)) return val;
                    if (isBareBase64(val)) return asDataUrl(val, kind === "audio" ? "audio/*" : "image/*");
                    if (typeof val === "string" && /^https?:\/\//i.test(val)) return val;
                    const url = await getMediaUrlById(val);
                    if (url) urlsToRevoke.push(url);
                    return url;
                })
            );
            if (active) setPreviews(res);
        })();
        return () => {
            active = false;
            urlsToRevoke.forEach((u) => u && URL.revokeObjectURL(u));
        };
    }, [pairs, kind]);
    return previews;
}

export function AudioPairsEditor({
    pairs,
    onChange,
    disabled,
}: {
    pairs: Pair<string, string>[];
    onChange: (pairs: Pair<string, string>[]) => void;
    disabled?: boolean;
}) {
    const previews = useMediaPairPreviews(pairs, "audio");

    const updateText = (idx: number, value: string) => {
        const next = pairs.map((p, i) => (i === idx ? [p[0], value] : p));
        onChange(next as Pair<string, string>[]);
    };

    const setAudio = async (idx: number, file: File | null) => {
        if (!file) return;
        const base64 = await fileToBase64(file);
        const next = pairs.map((p, i) => (i === idx ? [base64, p[1]] : p));
        onChange(next as Pair<string, string>[]);
    };

    const add = () => onChange([...pairs, ["", ""]]);
    const remove = (idx: number) => onChange(pairs.filter((_, i) => i !== idx));

    return (
        <>
            <div className={styles.header} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Аудио + Текст
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={add}>
                        Добавить
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {pairs.map(([audioVal, text], i) => {
                    const src = isDataUrl(audioVal)
                        ? audioVal
                        : isBareBase64(audioVal)
                            ? asDataUrl(audioVal, "audio/*")
                            : /^https?:\/\//i.test(audioVal)
                                ? audioVal
                                : previews[i] ?? null;
                    return (
                        <div key={i} className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => remove(i)}>✕ удалить</button>
                            )}
                            <div className={styles.mediaBlock}>
                                {src ? (
                                    <audio className={styles.audio} controls src={src}/>
                                ) : (
                                    <div className={styles.label}>
                                        {audioVal ? `аудио загружено (id: ${audioVal})` : "аудио не выбрано"}
                                    </div>
                                )}
                            </div>
                            <div className={styles.fieldsGrid}>
                                <FileInput
                                    label="Аудио"
                                    value={audioVal}
                                    accept="audio/*"
                                    onChange={(f) => setAudio(i, f)}
                                    disabled={disabled}
                                />
                                <label className={styles.label}>
                                    Ответ
                                    <RichTextEditor
                                        value={text}
                                        onChange={(v) => updateText(i, v)}
                                        placeholder="Текст"
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

export function ImagePairsEditor({
    pairs,
    onChange,
    disabled,
}: {
    pairs: Pair<string, string>[];
    onChange: (pairs: Pair<string, string>[]) => void;
    disabled?: boolean;
}) {
    const previews = useMediaPairPreviews(pairs, "image");

    const updateCaption = (idx: number, value: string) => {
        const next = pairs.map((p, i) => (i === idx ? [p[0], value] : p));
        onChange(next as Pair<string, string>[]);
    };

    const setImage = async (idx: number, file: File | null) => {
        if (!file) return;
        const base64 = await fileToBase64(file);
        const next = pairs.map((p, i) => (i === idx ? [base64, p[1]] : p));
        onChange(next as Pair<string, string>[]);
    };

    const add = () => onChange([...pairs, ["", ""]]);
    const remove = (idx: number) => onChange(pairs.filter((_, i) => i !== idx));

    return (
        <>
            <div className={styles.header} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Изображение + Текст
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={add}>
                        Добавить
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {pairs.map(([imgVal, caption], i) => {
                    const src = isDataUrl(imgVal)
                        ? imgVal
                        : isBareBase64(imgVal)
                            ? asDataUrl(imgVal, "image/*")
                            : /^https?:\/\//i.test(imgVal)
                                ? imgVal
                                : previews[i] ?? null;
                    return (
                        <div key={i} className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => remove(i)}>✕ удалить</button>
                            )}
                            <div className={styles.mediaBlock}>
                                {src ? (
                                    <img className={styles.image} src={src} alt=""/>
                                ) : (
                                    <div className={styles.label}>
                                        {imgVal ? `изображение загружено (id: ${imgVal})` : "изображение не выбрано"}
                                    </div>
                                )}
                            </div>
                            <div className={styles.fieldsGrid}>
                                <FileInput
                                    label="Изображение"
                                    value={imgVal}
                                    accept="image/*"
                                    onChange={(f) => setImage(i, f)}
                                    disabled={disabled}
                                />
                                <label className={styles.label}>
                                    Ответ
                                    <RichTextEditor
                                        value={caption}
                                        onChange={(v) => updateCaption(i, v)}
                                        placeholder="Подпись"
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}

