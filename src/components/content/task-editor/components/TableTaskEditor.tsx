import styles from "../ContentEditor.module.css";
import {UntranslatableField} from "../UntranslatableField";
import type {TableCellModel, TableCellType, TableRowModel} from "../TaskModels";

const createCell = (type: TableCellType = "READONLY"): TableCellModel => ({
    type,
    value: "",
    answer: type === "WRITABLE" ? "" : null,
});

const createRow = (): TableRowModel => ({
    cells: [createCell("READONLY"), createCell("WRITABLE")],
});

export function TableTaskEditor({
    value,
    onChange,
    disabled,
}: {
    value: TableRowModel[];
    onChange: (v: TableRowModel[]) => void;
    disabled?: boolean;
}) {
    const rows = value || [];

    const addRow = () => onChange([...rows, createRow()]);
    const removeRow = (rowIdx: number) => onChange(rows.filter((_, i) => i !== rowIdx));

    const patchCell = (rowIdx: number, cellIdx: number, patch: Partial<TableCellModel>) => {
        onChange(
            rows.map((row, i) => {
                if (i !== rowIdx) return row;
                return {
                    ...row,
                    cells: row.cells.map((cell, j) => (j === cellIdx ? {...cell, ...patch} : cell)),
                };
            })
        );
    };

    const addCell = (rowIdx: number) => {
        onChange(
            rows.map((row, i) =>
                i === rowIdx ? {...row, cells: [...row.cells, createCell("READONLY")]} : row
            )
        );
    };

    const removeCell = (rowIdx: number, cellIdx: number) => {
        onChange(
            rows.map((row, i) => {
                if (i !== rowIdx) return row;
                return {...row, cells: row.cells.filter((_, j) => j !== cellIdx)};
            })
        );
    };

    const setCellType = (rowIdx: number, cellIdx: number, type: TableCellType) => {
        const row = rows[rowIdx];
        const cell = row?.cells[cellIdx];
        if (!cell) return;
        patchCell(rowIdx, cellIdx, {
            type,
            answer: type === "WRITABLE" ? cell.answer ?? "" : null,
        });
    };

    return (
        <div>
            <div className={styles.header} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    Таблица
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addRow}>
                        Добавить строку
                    </button>
                )}
            </div>

            <div className={styles.list}>
                {rows.map((row, rowIdx) => (
                    <div key={rowIdx} className={styles.card}>
                        {!disabled && (
                            <button className={styles.removeButton} onClick={() => removeRow(rowIdx)}>
                                ✕ удалить строку
                            </button>
                        )}

                        <div className={styles.header} style={{marginTop: 0}}>
                            <h5 className={styles.title} style={{fontSize: "0.95rem"}}>
                                Строка {rowIdx + 1}
                            </h5>
                            {!disabled && (
                                <button className={styles.actionButton} onClick={() => addCell(rowIdx)}>
                                    Добавить ячейку
                                </button>
                            )}
                        </div>

                        <div className={styles.list}>
                            {row.cells.map((cell, cellIdx) => (
                                <div key={cellIdx} className={styles.card}>
                                    {!disabled && row.cells.length > 2 && (
                                        <button
                                            className={styles.removeButton}
                                            onClick={() => removeCell(rowIdx, cellIdx)}
                                        >
                                            ✕ удалить ячейку
                                        </button>
                                    )}

                                    <div className={styles.fieldsGrid}>
                                        <label className={styles.label}>
                                            Тип
                                            <select
                                                className={styles.input}
                                                value={cell.type}
                                                onChange={(e) =>
                                                    setCellType(rowIdx, cellIdx, e.target.value as TableCellType)
                                                }
                                                disabled={disabled}
                                            >
                                                <option value="READONLY">Чтение</option>
                                                <option value="WRITABLE">Заполняемая</option>
                                            </select>
                                        </label>

                                        <label className={styles.label}>
                                            Значение
                                            <UntranslatableField
                                                className={styles.input}
                                                value={cell.value || ""}
                                                onChange={(v) => patchCell(rowIdx, cellIdx, {value: v})}
                                                placeholder="Текст ячейки"
                                                disabled={disabled}
                                            />
                                        </label>

                                        {cell.type === "WRITABLE" && (
                                            <label className={styles.label}>
                                                Ответ
                                                <UntranslatableField
                                                    className={styles.input}
                                                    value={cell.answer || ""}
                                                    onChange={(v) => patchCell(rowIdx, cellIdx, {answer: v})}
                                                    placeholder="Правильный ответ"
                                                    disabled={disabled}
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
