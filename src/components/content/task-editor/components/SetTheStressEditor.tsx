import styles from "../ContentEditor.module.css";
import {UntranslatableField} from "../UntranslatableField";
import type {StressWordModel} from "../TaskModels";

const OPEN_TAG = "<translatable>";
const CLOSE_TAG = "</translatable>";

function stripTranslatableTags(word: string): string {
    return (word || "").replaceAll(OPEN_TAG, "").replaceAll(CLOSE_TAG, "");
}

function decorateStress(word: string, stressIndex: number): string {
    const clean = stripTranslatableTags(word);
    if (!clean) return "";
    if (stressIndex < 0 || stressIndex >= clean.length) return clean;
    return `${clean.slice(0, stressIndex + 1)}\u0301${clean.slice(stressIndex + 1)}`;
}

export function SetTheStressEditor({
    value,
    onChange,
    disabled,
}: {
    value: StressWordModel[];
    onChange: (v: StressWordModel[]) => void;
    disabled?: boolean;
}) {
    const addWord = () => onChange([...(value || []), {word: "", stressIndex: 0}]);
    const removeWord = (idx: number) => onChange((value || []).filter((_, i) => i !== idx));

    const patchWord = (idx: number, patch: Partial<StressWordModel>) => {
        onChange(
            (value || []).map((item, i) => {
                if (i !== idx) return item;
                const next = {...item, ...patch};
                const cleanWord = stripTranslatableTags(next.word || "");
                const maxIndex = Math.max(0, (cleanWord.length || 1) - 1);
                if (next.stressIndex < 0) next.stressIndex = 0;
                if (next.stressIndex > maxIndex) next.stressIndex = maxIndex;
                return next;
            })
        );
    };

    return (
        <>
            <div className={styles.header} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Поставьте ударение
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addWord}>
                        Добавить слово
                    </button>
                )}
            </div>
            <div className={styles.list}>
                {(value || []).map((item, i) => (
                    <div key={i} className={styles.card}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeWord(i)}>
                                ✕ удалить
                            </button>
                        )}
                        <div className={styles.fieldsColumn}>
                            <label className={styles.label}>
                                Слово
                                <UntranslatableField
                                    className={styles.input}
                                    value={item.word || ""}
                                    onChange={(v) => patchWord(i, {word: v})}
                                    placeholder="Введите слово"
                                    disabled={disabled}
                                />
                            </label>
                            <label className={styles.label}>
                                Индекс ударения
                                <input
                                    className={styles.input}
                                    type="number"
                                    min={1}
                                    max={Math.max(1, stripTranslatableTags(item.word || "").length || 1)}
                                    value={(Number.isFinite(item.stressIndex) ? item.stressIndex : 0) + 1}
                                    onChange={(e) =>
                                        patchWord(i, {
                                            stressIndex: Math.max(
                                                0,
                                                (Number.isFinite(+e.target.value) ? Number(e.target.value) : 1) - 1
                                            ),
                                        })
                                    }
                                    disabled={disabled}
                                />
                            </label>
                            <div className={styles.hint}>
                                Превью: <strong>{decorateStress(item.word || "", item.stressIndex || 0)}</strong>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
}
