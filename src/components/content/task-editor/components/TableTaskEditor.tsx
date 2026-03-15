import styles from "../ContentEditor.module.css";
import {UntranslatableField} from "../UntranslatableField";
import type {TableCellModel, TableCellType, TableRowModel} from "../TaskModels";
import {CompactEditorItem, plainTextPreview} from "./CompactEditorItem";

const TABLE_TITLE = "Таблица";
const ADD_ROW = "Добавить строку";
const ROW_TITLE = "Строка";
const EMPTY_CELL = "Пустая ячейка";
const DELETE_ROW = "✕ удалить строку";
const ADD_CELL = "Добавить ячейку";
const CELL_TITLE = "Ячейка";
const DELETE_CELL = "✕ удалить ячейку";
const TYPE_LABEL = "Тип";
const READONLY_LABEL = "Только чтение";
const WRITABLE_LABEL = "Заполняемая";
const PREFIX_LABEL = "Префикс";
const PREFIX_PLACEHOLDER = "Текст до ответа";
const SUFFIX_LABEL = "Суффикс";
const SUFFIX_PLACEHOLDER = "Текст после ответа";
const PLACEHOLDER_LABEL = "Placeholder";
const PLACEHOLDER_PLACEHOLDER = "Текст подсказки";
const ANSWER_LABEL = "Ответ";
const ANSWER_PLACEHOLDER = "Правильный ответ";

const createCell = (type: TableCellType = "READONLY"): TableCellModel => ({
    type,
    prefix: "",
    placeholder: null,
    suffix: "",
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
            placeholder: type === "WRITABLE" ? cell.placeholder ?? "" : null,
            answer: type === "WRITABLE" ? cell.answer ?? "" : null,
        });
    };

    return (
        <div>
            <div className={`${styles.header} ${styles.stickyToolbar}`} style={{marginTop: 4}}>
                <h4 className={styles.title} style={{fontSize: "1rem"}}>
                    {TABLE_TITLE}
                </h4>
                {!disabled && (
                    <button className={styles.actionButton} onClick={addRow}>
                        {ADD_ROW}
                    </button>
                )}
            </div>

            <div className={styles.list}>
                {rows.map((row, rowIdx) => (
                    <CompactEditorItem
                        key={rowIdx}
                        title={`${ROW_TITLE} ${rowIdx + 1}`}
                        preview={row.cells.map((cell) => plainTextPreview(cell.prefix || cell.answer || cell.placeholder || cell.suffix || "", EMPTY_CELL)).join(" | ")}
                        defaultOpen={rowIdx === 0}
                    >
                        <div className={styles.card}>
                            {!disabled && (
                                <button className={styles.removeButton} onClick={() => removeRow(rowIdx)}>
                                    {DELETE_ROW}
                                </button>
                            )}

                            <div className={styles.header} style={{marginTop: 0}}>
                                <h5 className={styles.title} style={{fontSize: "0.95rem"}}>
                                    {`${ROW_TITLE} ${rowIdx + 1}`}
                                </h5>
                                {!disabled && (
                                    <button className={styles.actionButton} onClick={() => addCell(rowIdx)}>
                                        {ADD_CELL}
                                    </button>
                                )}
                            </div>

                            <div className={styles.list}>
                                {row.cells.map((cell, cellIdx) => (
                                    <CompactEditorItem
                                        key={cellIdx}
                                        title={`${CELL_TITLE} ${cellIdx + 1}`}
                                        preview={plainTextPreview(cell.prefix || cell.answer || cell.placeholder || cell.suffix || "", EMPTY_CELL)}
                                    >
                                        <div className={styles.card}>
                                            {!disabled && row.cells.length > 2 && (
                                                <button
                                                    className={styles.removeButton}
                                                    onClick={() => removeCell(rowIdx, cellIdx)}
                                                >
                                                    {DELETE_CELL}
                                                </button>
                                            )}

                                            <div className={styles.fieldsGrid}>
                                                <label className={styles.label}>
                                                    {TYPE_LABEL}
                                                    <select
                                                        className={styles.input}
                                                        value={cell.type}
                                                        onChange={(e) =>
                                                            setCellType(rowIdx, cellIdx, e.target.value as TableCellType)
                                                        }
                                                        disabled={disabled}
                                                    >
                                                        <option value="READONLY">{READONLY_LABEL}</option>
                                                        <option value="WRITABLE">{WRITABLE_LABEL}</option>
                                                    </select>
                                                </label>

                                                <label className={styles.label}>
                                                    {PREFIX_LABEL}
                                                    <UntranslatableField
                                                        className={styles.input}
                                                        value={cell.prefix || ""}
                                                        onChange={(v) => patchCell(rowIdx, cellIdx, {prefix: v})}
                                                        placeholder={PREFIX_PLACEHOLDER}
                                                        disabled={disabled}
                                                    />
                                                </label>

                                                <label className={styles.label}>
                                                    {SUFFIX_LABEL}
                                                    <UntranslatableField
                                                        className={styles.input}
                                                        value={cell.suffix || ""}
                                                        onChange={(v) => patchCell(rowIdx, cellIdx, {suffix: v})}
                                                        placeholder={SUFFIX_PLACEHOLDER}
                                                        disabled={disabled}
                                                    />
                                                </label>

                                                {cell.type === "WRITABLE" && (
                                                    <label className={styles.label}>
                                                        {PLACEHOLDER_LABEL}
                                                        <UntranslatableField
                                                            className={styles.input}
                                                            value={cell.placeholder || ""}
                                                            onChange={(v) => patchCell(rowIdx, cellIdx, {placeholder: v || null})}
                                                            placeholder={PLACEHOLDER_PLACEHOLDER}
                                                            disabled={disabled}
                                                        />
                                                    </label>
                                                )}

                                                {cell.type === "WRITABLE" && (
                                                    <label className={styles.label}>
                                                        {ANSWER_LABEL}
                                                        <UntranslatableField
                                                            className={styles.input}
                                                            value={cell.answer || ""}
                                                            onChange={(v) => patchCell(rowIdx, cellIdx, {answer: v})}
                                                            placeholder={ANSWER_PLACEHOLDER}
                                                            disabled={disabled}
                                                        />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    </CompactEditorItem>
                                ))}
                            </div>
                        </div>
                    </CompactEditorItem>
                ))}
            </div>
        </div>
    );
}
