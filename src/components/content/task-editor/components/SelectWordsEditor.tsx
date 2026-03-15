import React from "react";
import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import {FileInput} from "./FileInput";
import type {SelectWordsModel} from "../TaskModels";
import {asDataUrl, fileToBase64, getMediaUrlById, isBareBase64, isDataUrl} from "../mediaUtils";
import {CompactEditorItem, plainTextPreview} from "./CompactEditorItem";

export function SelectWordsEditor({value, onChange, disabled}: {
    value: SelectWordsModel;
    onChange: (v: SelectWordsModel) => void;
    disabled?: boolean;
}) {
    const [audioPreview, setAudioPreview] = React.useState<string | null>(null);
    React.useEffect(() => {
        let active = true;
        (async () => {
            const audio = value.audio;
            if (!audio) {
                if (active) setAudioPreview(null);
                return;
            }
            if (isDataUrl(audio)) {
                if (active) setAudioPreview(audio);
                return;
            }
            if (isBareBase64(audio)) {
                if (active) setAudioPreview(asDataUrl(audio, "audio/*"));
                return;
            }
            if (/^https?:\/\//i.test(audio)) {
                if (active) setAudioPreview(audio);
                return;
            }
            const url = await getMediaUrlById(audio);
            if (active) setAudioPreview(url);
        })();
        return () => {
            active = false;
        };
    }, [value.audio]);

    const setAudio = async (file: File | null) => {
        if (!file) return;
        const base64 = await fileToBase64(file);
        onChange({...value, audio: base64});
    };

    const setAudioUrl = (audio: string) => {
        onChange({...value, audio});
    };

    const setVariantText = (idx: number, text: string) =>
        onChange({...value, variants: value.variants.map((v, i) => (i === idx ? [text, v[1]] : v))});

    const setOnlyCorrect = (idx: number) =>
        onChange({...value, variants: value.variants.map((v, i) => [v[0], i === idx])});

    const addVariant = () => onChange({...value, variants: [...value.variants, ["", false]]});
    const removeVariant = (idx: number) => onChange({...value, variants: value.variants.filter((_, i) => i !== idx)});

    return (
        <div>
            <div className={`${styles.header} ${styles.stickyToolbar}`}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Выбор слов
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addVariant}>
                        Добавить вариант
                    </button>
                )}
            </div>
            <div className={styles.card}>
                <FileInput
                    label="Аудио"
                    value={value.audio}
                    accept="audio/*"
                    onChange={(f) => setAudio(f)}
                    onValueChange={setAudioUrl}
                    urlPlaceholder="https://example.com/audio.mp3"
                    disabled={disabled}
                />
                {audioPreview ? (
                    <audio className={styles.audio} controls src={audioPreview}/>
                ) : value.audio ? (
                    <div className={styles.label} style={{marginTop: 8}}>
                        Аудио загружено (id: {value.audio})
                    </div>
                ) : null}
            </div>
            <div className={styles.list}>
                {value.variants.map(([text, correct], i) => (
                    <CompactEditorItem
                        key={i}
                        title={`Вариант ${i + 1}${correct ? " • правильный" : ""}`}
                        preview={plainTextPreview(text, "Пустой вариант")}
                        defaultOpen={i === 0}
                    >
                        <div className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => removeVariant(i)}>✕ удалить</button>
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
                                        name="select-words-correct"
                                        checked={correct}
                                        onChange={() => setOnlyCorrect(i)}
                                        disabled={disabled}
                                    />
                                    <span>Правильный</span>
                                </div>
                            </div>
                        </div>
                    </CompactEditorItem>
                ))}
            </div>
        </div>
    );
}
