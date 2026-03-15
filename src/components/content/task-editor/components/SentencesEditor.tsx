import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import type {Gap, Sentence} from "../TaskModels";
import {CompactEditorItem, plainTextPreview} from "./CompactEditorItem";

export function SentencesEditor({
    sentences,
    onChange,
    disabled,
}: {
    sentences: Sentence[];
    onChange: (s: Sentence[]) => void;
    disabled?: boolean;
}) {
    const addSentence = () => onChange([...sentences, {label: "", text: "", gaps: []}]);
    const removeSentence = (idx: number) => onChange(sentences.filter((_, i) => i !== idx));
    const setSentenceLabel = (idx: number, label: string) => {
        onChange(sentences.map((s, i) => (i === idx ? {...s, label} : s)));
    };
    const setSentenceText = (idx: number, text: string) => {
        onChange(sentences.map((s, i) => (i === idx ? {...s, text} : s)));
    };

    return (
        <>
            <div className={`${styles.header} ${styles.stickyToolbar}`} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Предложения
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addSentence}>
                        Добавить предложение
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {sentences.map((s, i) => (
                    <CompactEditorItem
                        key={i}
                        title={`Предложение ${i + 1}`}
                        preview={plainTextPreview(s.text || s.label, "Пустое предложение")}
                        defaultOpen={i === 0}
                    >
                        <div className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => removeSentence(i)}>✕ удалить</button>
                            )}
                            <label className={styles.label}>
                                Заголовок
                                <RichTextEditor
                                    value={s.label}
                                    onChange={(v) => setSentenceLabel(i, v)}
                                    placeholder="Заголовок блока..."
                                    disabled={disabled}
                                />
                            </label>
                            <label className={styles.label}>
                                Текст
                                <RichTextEditor
                                    value={s.text}
                                    onChange={(v) => setSentenceText(i, v)}
                                    placeholder="Текст предложения..."
                                    disabled={disabled}
                                />
                            </label>
                            <GapsEditor
                                gaps={s.gaps}
                                onChange={(g) =>
                                    onChange(sentences.map((it, j) => (j === i ? {...it, gaps: g} : it)))
                                }
                                disabled={disabled}
                            />
                        </div>
                    </CompactEditorItem>
                ))}
            </div>
        </>
    );
}

function GapsEditor({
    gaps,
    onChange,
    disabled,
}: {
    gaps: Gap[];
    onChange: (g: Gap[]) => void;
    disabled?: boolean;
}) {
    const addGap = () => onChange([...gaps, {correctWord: "", indexWord: gaps.length}]);
    const removeGap = (idx: number) => onChange(gaps.filter((_, i) => i !== idx));
    const updateGap = (idx: number, patch: Partial<Gap>) =>
        onChange(
            gaps.map((g, i) => {
                if (i !== idx) return g;
                const next = {...g, ...patch};
                if (typeof next.indexWord === "number" && next.indexWord < 0) next.indexWord = 0;
                return next;
            })
        );

    return (
        <div>
            <div className={`${styles.header} ${styles.stickyToolbar}`} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "0.95rem"}}>
                    Пропуски
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addGap}>
                        Добавить пропуск
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {gaps.map((g, i) => (
                    <CompactEditorItem
                        key={i}
                        title={`Пропуск ${i + 1}`}
                        preview={`${plainTextPreview(g.correctWord, "Пустой ответ")} • индекс ${g.indexWord}`}
                    >
                        <div className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => removeGap(i)}>✕ удалить</button>
                            )}
                            <div className={styles.fieldsColumn}>
                                <label className={styles.label}>
                                    Правильное слово
                                    <RichTextEditor
                                        value={g.correctWord}
                                        onChange={(v) => updateGap(i, {correctWord: v})}
                                        placeholder="Правильный ответ"
                                        disabled={disabled}
                                    />
                                </label>
                                <label className={styles.label}>
                                    Индекс
                                    <input
                                        className={styles.input}
                                        type="number"
                                        min={0}
                                        value={g.indexWord}
                                        onChange={(e) =>
                                            updateGap(i, {
                                                indexWord: Math.max(0, Number.isFinite(+e.target.value) ? Number(e.target.value) : 0),
                                            })
                                        }
                                        placeholder="индекс"
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                        </div>
                    </CompactEditorItem>
                ))}
            </div>
        </div>
    );
}
