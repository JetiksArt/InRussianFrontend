import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import type {GapWithVariantModel, TextInputWithVariantModel} from "../TaskModels";

export function TextWithVariantGapsEditor({
    value,
    onChange,
    disabled,
}: {
    value: TextInputWithVariantModel;
    onChange: (v: TextInputWithVariantModel) => void;
    disabled?: boolean;
}) {
    const setLabel = (label: string) => onChange({...value, label});
    const setText = (text: string) => onChange({...value, text});

    const addGap = () =>
        onChange({
            ...value,
            gaps: [...value.gaps, {indexWord: value.gaps.length, variants: [""], correctVariant: ""}],
        });

    const removeGap = (idx: number) => onChange({...value, gaps: value.gaps.filter((_, i) => i !== idx)});

    const updateGap = (idx: number, patch: Partial<GapWithVariantModel>) =>
        onChange({...value, gaps: value.gaps.map((g, i) => (i === idx ? {...g, ...patch} : g))});

    const addVariant = (idx: number) =>
        onChange({
            ...value,
            gaps: value.gaps.map((g, i) => (i === idx ? {...g, variants: [...g.variants, ""]} : g)),
        });

    const setVariant = (gapIdx: number, optIdx: number, val: string) => {
        const oldVal = value.gaps[gapIdx]?.variants[optIdx];
        onChange({
            ...value,
            gaps: value.gaps.map((g, i) => {
                if (i !== gapIdx) return g;
                const newVariants = g.variants.map((o, j) => (j === optIdx ? val : o));
                const nextCorrect = g.correctVariant === oldVal ? val : g.correctVariant;
                return {...g, variants: newVariants, correctVariant: nextCorrect};
            }),
        });
    };

    const removeVariant = (gapIdx: number, optIdx: number) => {
        const removedVal = value.gaps[gapIdx]?.variants[optIdx];
        onChange({
            ...value,
            gaps: value.gaps.map((g, i) => {
                if (i !== gapIdx) return g;
                const newVariants = g.variants.filter((_, j) => j !== optIdx);
                const nextCorrect = g.correctVariant === removedVal ? "" : g.correctVariant;
                return {...g, variants: newVariants, correctVariant: nextCorrect};
            }),
        });
    };

    return (
        <div>
            <div className={styles.header} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>Текст с вариантами пропусков</h4>
            </div>
            <div className={styles.card}>
                <label className={styles.label}>
                    Заголовок
                    <RichTextEditor
                        value={value.label}
                        onChange={(v) => setLabel(v)}
                        disabled={disabled}
                    />
                </label>
                <label className={styles.label}>
                    Текст
                    <RichTextEditor
                        value={value.text}
                        onChange={(v) => setText(v)}
                        disabled={disabled}
                    />
                </label>
            </div>
            <div className={styles.header} style={{marginTop: 8}}>
                <h4 className={styles.title} style={{fontSize: "0.95rem"}}>Пропуски</h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addGap}>
                        Добавить пропуск
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {value.gaps.map((gap, i) => (
                    <div key={i} className={styles.card}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeGap(i)}>
                                ✕ удалить
                            </button>
                        )}
                        <div className={styles.fieldsGrid}>
                            <label className={styles.label}>
                                Позиция
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={0}
                                    value={(gap as any).indexWord}
                                    onChange={(e) => updateGap(i, {indexWord: Math.max(0, Number(e.target.value || 0))} as any)}
                                    disabled={disabled}
                                />
                            </label>
                        </div>
                        <div className={styles.fieldsGrid} style={{marginTop: 8}}>
                            {gap.variants.map((option, j) => (
                                <div key={j}>
                                    <label className={styles.label}>
                                        Вариант {j + 1}
                                        <RichTextEditor
                                            value={option}
                                            onChange={(v) => setVariant(i, j, v)}
                                            disabled={disabled}
                                        />
                                    </label>
                                    <div className={styles.label} style={{display: "flex", alignItems: "center", gap: 8}}>
                                        <input
                                            type="radio"
                                            name={`correct-${i}`}
                                            checked={gap.correctVariant === option}
                                            onChange={() => updateGap(i, {correctVariant: option})}
                                            disabled={disabled}
                                        />
                                        <span>Правильный</span>
                                    </div>
                                    {!disabled && (
                                        <button
                                            className={styles.removeButton}
                                            style={{position: "static", marginTop: 6}}
                                            onClick={() => removeVariant(i, j)}
                                        >
                                            Удалить вариант
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {!disabled && (
                            <button className={styles.actionButton} onClick={() => addVariant(i)} style={{marginTop: 8}}>
                                добавить вариант
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

