import React from "react";
import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import {FileInput} from "./FileInput";
import type {ConstructSentenceModel} from "../TaskModels";
import {asDataUrl, fileToBase64, getMediaUrlById, isBareBase64, isDataUrl} from "../mediaUtils";

export function ConstructSentenceEditor({value, onChange, disabled}: {
    value: ConstructSentenceModel;
    onChange: (v: ConstructSentenceModel) => void;
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

    const setWord = (idx: number, word: string) =>
        onChange({...value, variants: value.variants.map((v, i) => (i === idx ? word : v))});

    const addWord = () => onChange({...value, variants: [...value.variants, ""]});
    const removeWord = (idx: number) => onChange({...value, variants: value.variants.filter((_, i) => i !== idx)});

    return (
        <div>
            <div className={styles.header}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Собери предложение
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addWord}>
                        Добавить слово
                    </button>
                )}
            </div>
            <div className={styles.card}>
                <FileInput
                    label="Аудио (опц.)"
                    value={value.audio}
                    accept="audio/*"
                    onChange={(f) => setAudio(f)}
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
            <div className={styles.wordsGrid}>
                {value.variants.map((word, i) => (
                    <div key={i} className={`${styles.card} ${styles.wordCard}`}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeWord(i)}>
                                ✕
                            </button>
                        )}
                        <label className={styles.label}>
                            Слово {i + 1}
                            <RichTextEditor
                                value={word}
                                onChange={(v) => setWord(i, v)}
                                disabled={disabled}
                            />
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

