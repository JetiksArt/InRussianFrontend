import styles from "../ContentEditor.module.css";
import {RichTextEditor} from "../RichTextEditor";
import type {Pair} from "../TaskModels";
import {CompactEditorItem, plainTextPreview} from "./CompactEditorItem";

export function PairsEditor({
    title,
    pairs,
    onChange,
    leftPlaceholder,
    rightPlaceholder,
    mediaPreview,
    disabled,
}: {
    title: string;
    pairs: Pair<string, string>[];
    onChange: (pairs: Pair<string, string>[]) => void;
    leftPlaceholder?: string;
    rightPlaceholder?: string;
    mediaPreview?: "image";
    disabled?: boolean;
}) {
    const updatePair = (idx: number, side: 0 | 1, value: string) => {
        const next = pairs.map((pair, i) => (i === idx ? (side === 0 ? [value, pair[1]] : [pair[0], value]) : pair));
        onChange(next as Pair<string, string>[]);
    };

    const addPair = () => onChange([...pairs, ["", ""]]);
    const removePair = (idx: number) => onChange(pairs.filter((_, i) => i !== idx));

    return (
        <>
            <div className={`${styles.header} ${styles.stickyToolbar}`} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    {title}
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addPair}>
                        Добавить
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {pairs.map(([left, right], idx) => (
                    <CompactEditorItem
                        key={idx}
                        title={`Пара ${idx + 1}`}
                        preview={`${plainTextPreview(left, "Пустое левое поле")} -> ${plainTextPreview(right, "Пустое правое поле")}`}
                        defaultOpen={idx === 0}
                    >
                        <div className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => removePair(idx)}>
                                    ✕ удалить
                                </button>
                            )}
                            {mediaPreview === "image" && left && (
                                <div className={styles.mediaPreview}>
                                    <img className={styles.image} src={left} alt="" />
                                </div>
                            )}
                            <div className={styles.fieldsColumn}>
                                <label className={styles.label}>
                                    Левое поле
                                    <RichTextEditor
                                        value={left}
                                        onChange={(value) => updatePair(idx, 0, value)}
                                        placeholder={leftPlaceholder}
                                        disabled={disabled}
                                    />
                                </label>
                                <label className={styles.label}>
                                    Правое поле
                                    <RichTextEditor
                                        value={right}
                                        onChange={(value) => updatePair(idx, 1, value)}
                                        placeholder={rightPlaceholder}
                                        disabled={disabled}
                                    />
                                </label>
                            </div>
                        </div>
                    </CompactEditorItem>
                ))}
            </div>
        </>
    );
}
