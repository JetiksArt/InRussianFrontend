import React from "react";
import styles from "../ContentEditor.module.css";
import {isBareBase64, isDataUrl} from "../mediaUtils";

interface FileInputProps {
    value?: string | null;
    onChange: (file: File | null) => void;
    onValueChange?: (value: string) => void;
    accept?: string;
    disabled?: boolean;
    label?: string;
    className?: string;
    urlPlaceholder?: string;
}

export function FileInput({
    value,
    onChange,
    onValueChange,
    accept,
    disabled,
    label,
    className,
    urlPlaceholder = "https://example.com/file",
}: FileInputProps) {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const hasValue = !!value;
    const isLong = value && (isDataUrl(value) || isBareBase64(value));
    const isExternalUrl = typeof value === "string" && /^https?:\/\//i.test(value);
    const displayText = hasValue
        ? (isLong ? "Файл загружен" : isExternalUrl ? `Ссылка: ${value}` : `Файл: ${value}`)
        : "Файл не выбран";

    const handleClick = () => {
        inputRef.current?.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        onChange(file);
    };

    return (
        <div className={className}>
            {label && <div className={styles.label} style={{marginBottom: 4}}>{label}</div>}
            <div style={{display: "flex", flexDirection: "column", gap: 10}}>
                <div style={{display: "flex", alignItems: "center", gap: 12}}>
                    <button
                        type="button"
                        className={styles.actionButton}
                        onClick={handleClick}
                        disabled={disabled}
                        style={{
                            background: "transparent",
                            color: "var(--color-text)",
                            border: "1px solid var(--color-border)",
                            padding: "6px 12px",
                        }}
                    >
                        {hasValue ? "Изменить файл" : "Выбрать файл"}
                    </button>
                    <span
                        style={{
                            fontSize: "0.9rem",
                            color: "var(--color-text-secondary)",
                            fontStyle: hasValue ? "normal" : "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: "300px",
                        }}
                    >
                        {displayText}
                    </span>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={accept}
                        onChange={handleFileChange}
                        disabled={disabled}
                        style={{display: "none"}}
                    />
                </div>
                {onValueChange && (
                    <label className={styles.label} style={{marginBottom: 0}}>
                        Внешняя ссылка
                        <input
                            className={styles.input}
                            value={isLong ? "" : (value || "")}
                            onChange={(e) => onValueChange(e.target.value)}
                            placeholder={urlPlaceholder}
                            disabled={disabled}
                            style={{marginTop: 6}}
                        />
                    </label>
                )}
            </div>
        </div>
    );
}
