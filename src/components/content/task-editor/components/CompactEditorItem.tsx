import type { ReactNode } from "react";
import styles from "../ContentEditor.module.css";

export function plainTextPreview(value: string | null | undefined, fallback = "Нажмите, чтобы открыть редактор") {
    const normalized = (value || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    if (!normalized) return fallback;
    return normalized.length > 50 ? `${normalized.slice(0, 50)}...` : normalized;
}

export function CompactEditorItem({
    title,
    preview,
    children,
    defaultOpen = false,
}: {
    title: string;
    preview: string;
    children: ReactNode;
    defaultOpen?: boolean;
}) {
    return (
        <details className={styles.compactCard} open={defaultOpen}>
            <summary className={styles.compactSummary}>
                <div className={styles.compactSummaryText}>
                    <div className={styles.compactTitle}>{title}</div>
                    <div className={styles.compactPreview}>{preview}</div>
                </div>
                <span className={styles.compactChevron}>▾</span>
            </summary>
            <div className={styles.compactBody}>{children}</div>
        </details>
    );
}
