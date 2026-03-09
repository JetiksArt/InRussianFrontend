import React from "react";
import cls from "./UntranslatableField.module.css";

const MARK_LABEL = "Переводится";
const OPEN_TAG = "<translatable>";
const CLOSE_TAG = "</translatable>";
const OPEN_M = "\uE000";
const CLOSE_M = "\uE001";

type Props = {
    value: string;
    onChange: (next: string) => void;
    className?: string;
    disabled?: boolean;
    placeholder?: string;
    multiline?: boolean;
    showToolbar?: boolean;
    style?: React.CSSProperties;
};

function escapeHtml(s: string): string {
    return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function valueToHtml(value: string, multiline: boolean): string {
    const withMarkers = value
        .replaceAll(OPEN_TAG, OPEN_M)
        .replaceAll(CLOSE_TAG, CLOSE_M);

    const escaped = escapeHtml(withMarkers);
    const withUt = escaped
        .replaceAll(OPEN_M, '<span data-ut="1" class="ut">')
        .replaceAll(CLOSE_M, "</span>");

    if (!multiline) {
        // для однострочного — убрать переносы (сохраним как пробел)
        return withUt.replace(/\r?\n/g, " ");
    }
    // для многострочного — BR для новой строки
    return withUt.replace(/\r?\n/g, "<br>");
}

function serializeNode(node: Node, buf: string[]) {
    if (node.nodeType === Node.TEXT_NODE) {
        buf.push((node as Text).nodeValue || "");
        return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
        return;
    }
    const el = node as HTMLElement;

    // BR -> перенос строки
    if (el.tagName === "BR") {
        buf.push("\n");
        return;
    }

    const isUt = el.hasAttribute("data-ut");
    if (isUt) buf.push(OPEN_TAG);

    // Некоторые браузеры создают DIV/P внутри contentEditable при Enter
    const isBlock = el.tagName === "DIV" || el.tagName === "P";
    const children = Array.from(el.childNodes);
    children.forEach((ch) => {
        serializeNode(ch, buf);
    });

    // перенос строки после блока
    if (isBlock) {
        buf.push("\n");
    }

    if (isUt) buf.push(CLOSE_TAG);
}

function htmlToValue(root: HTMLElement): string {
    const buf: string[] = [];
    const children = Array.from(root.childNodes);
    children.forEach((n) => serializeNode(n, buf));
    // Нормализуем лишние переносы, убираем хвостовой \n
    let s = buf.join("");
    s = s.replace(/\u00A0/g, " "); // NBSP -> space
    s = s.replace(/\r/g, "");
    // Удаляем один завершающий перенос, который может появиться от блоков
    s = s.replace(/\n$/, "");
    return s;
}

function isSelectionInside(el: HTMLElement): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    return el.contains(range.commonAncestorContainer);
}

// Helper: unwrap a span[data-ut] preserving its children
function unwrapUt(span: HTMLElement) {
    const parent = span.parentNode;
    if (!parent) return;
    while (span.firstChild) {
        parent.insertBefore(span.firstChild, span);
    }
    parent.removeChild(span);
}

// Helper: does selection range intersect node contents
function rangeIntersectsNode(range: Range, node: Node): boolean {
    // Prefer native API when available
    // @ts-ignore
    if (typeof (range as any).intersectsNode === "function") {
        try {
            // @ts-ignore
            return (range as any).intersectsNode(node);
        } catch {
            // fall through to manual
        }
    }
    const doc = node.ownerDocument || document;
    const nodeRange = doc.createRange();
    try {
        nodeRange.selectNodeContents(node);
    } catch {
        return false;
    }
    // No intersection when range.end <= node.start OR range.start >= node.end
    const endsBeforeOrAtStart = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0;
    const startsAfterOrAtEnd = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0;
    return !(endsBeforeOrAtStart || startsAfterOrAtEnd);
}

function mergeAdjacentUt(node: HTMLElement) {
    const isUt = (child: Node | null): child is HTMLElement =>
        !!child && child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).hasAttribute("data-ut");

    let prev = node.previousSibling;
    if (isUt(prev)) {
        const prevEl = prev as HTMLElement;
        while (prevEl.firstChild) {
            node.insertBefore(prevEl.firstChild, node.firstChild);
        }
        prevEl.remove();
    }

    let next = node.nextSibling;
    if (isUt(next)) {
        const nextEl = next as HTMLElement;
        while (nextEl.firstChild) {
            node.appendChild(nextEl.firstChild);
        }
        nextEl.remove();
    }
}

function cleanupOverlappingUt(root: HTMLElement, range: Range) {
    const spans = Array.from(root.querySelectorAll<HTMLElement>('[data-ut]'));
    spans.forEach((span) => {
        if (rangeIntersectsNode(range, span)) {
            unwrapUt(span);
        }
    });
    root.normalize();
}

function wrapSelectionAsUt(root: HTMLElement) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (range.collapsed || !root.contains(range.commonAncestorContainer)) return;

    const normalizedRange = range.cloneRange();
    cleanupOverlappingUt(root, normalizedRange);

    selection.removeAllRanges();
    selection.addRange(normalizedRange);

    const fragment = normalizedRange.extractContents();
    const span = root.ownerDocument!.createElement("span");
    span.setAttribute("data-ut", "1");
    span.className = "ut";
    span.appendChild(fragment);
    Array.from(span.querySelectorAll<HTMLElement>('[data-ut]')).forEach(unwrapUt);

    normalizedRange.insertNode(span);
    mergeAdjacentUt(span);

    const caret = document.createRange();
    caret.setStartAfter(span);
    caret.collapse(true);
    selection.removeAllRanges();
    selection.addRange(caret);

    root.normalize();
}

export function UntranslatableField({
                                        value,
                                        onChange,
                                        className,
                                        disabled,
                                        placeholder,
                                        multiline = false,
                                        showToolbar = true,
                                        style,
                                    }: Props) {
    const ref = React.useRef<HTMLDivElement | null>(null);
    const lastSerialized = React.useRef<string>("");

    // Инициализируем/синхронизируем DOM, только если проп `value` реально изменился
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        if (value === lastSerialized.current) return;
        el.innerHTML = valueToHtml(value ?? "", multiline);
        lastSerialized.current = value ?? "";
    }, [value, multiline]);

    const handleInput = () => {
        if (!ref.current) return;
        const serialized = htmlToValue(ref.current);
        lastSerialized.current = serialized;
        onChange(serialized);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!multiline && e.key === "Enter") {
            e.preventDefault();
            return;
        }
    };

    const handleWrapClick = () => {
        if (!ref.current) return;
        if (disabled) return;
        if (!isSelectionInside(ref.current)) return;
        wrapSelectionAsUt(ref.current);
        handleInput();
        // Вернём фокус обратно в редактируемую область, чтобы пользователь мог продолжать печатать
        ref.current.focus();
    };

    return (
        <div className={cls.root}>
            <div
                ref={ref}
                role="textbox"
                className={[
                    cls.editable,
                    !multiline ? cls.singleLine : "",
                    className || "",
                    placeholder ? cls.placeholder : "",
                ].join(" ")}
                style={style}
                contentEditable={!disabled}
                suppressContentEditableWarning
                data-placeholder={placeholder || ""}
                onInput={handleInput}
                onBlur={handleInput}
                onKeyDown={handleKeyDown}
                spellCheck={false}
            />
            {showToolbar && (
                <div className={cls.toolbar}>
                    <button
                        type="button"
                        className={cls.btn}
                        // Важно: не даём кнопке забирать фокус, чтобы выделение не терялось
                        onMouseDown={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
                        onMouseUp={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}
                        onClick={handleWrapClick}
                        disabled={disabled}
                        title="Обозначить как «Не переводится»"
                    >
                        {MARK_LABEL}
                    </button>
                </div>
            )}
        </div>
    );
}
