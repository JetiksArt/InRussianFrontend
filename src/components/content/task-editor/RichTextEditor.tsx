import React from "react";
import styles from "./ContentEditor.module.css";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

type Command =
  | "bold"
  | "italic"
  | "underline"
  | "insertUnorderedList"
  | "insertOrderedList"
  | "translatable";

const COMMANDS: Array<{ cmd: Command; label: string; title: string }> = [
  { cmd: "bold", label: "B", title: "Bold" },
  { cmd: "italic", label: "I", title: "Italic" },
  { cmd: "underline", label: "U", title: "Underline" },
  { cmd: "insertUnorderedList", label: "* Текст", title: "Маркированный список" },
  { cmd: "insertOrderedList", label: "1.Текст", title: "Нумерованный список" },
  { cmd: "translatable", label: "Переводить", title: "Отметить выделенное как переводимое" },
];

function normalizeFromWire(value: string): string {
  if (!value) return "";
  const root = document.createElement("div");
  root.innerHTML = value;
  const tags = Array.from(root.querySelectorAll("translatable"));
  tags.forEach((node) => {
    const span = document.createElement("span");
    span.setAttribute("data-ut", "1");
    span.className = "ut";
    while (node.firstChild) span.appendChild(node.firstChild);
    node.replaceWith(span);
  });
  return root.innerHTML;
}

function serializeToWire(html: string): string {
  if (!html) return "";
  const root = document.createElement("div");
  root.innerHTML = html;
  const spans = Array.from(root.querySelectorAll("span[data-ut='1']"));
  spans.forEach((span) => {
    const tag = document.createElement("translatable");
    while (span.firstChild) tag.appendChild(span.firstChild);
    span.replaceWith(tag);
  });
  return root.innerHTML;
}

function isSelectionInside(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  return el.contains(range.commonAncestorContainer);
}

function rangeIntersectsNode(range: Range, node: Node): boolean {
  const anyRange = range as any;
  if (typeof anyRange.intersectsNode === "function") {
    try {
      return anyRange.intersectsNode(node);
    } catch {
      // fall through
    }
  }
  const doc = node.ownerDocument || document;
  const nodeRange = doc.createRange();
  try {
    nodeRange.selectNodeContents(node);
  } catch {
    return false;
  }
  const endsBeforeOrAtStart = range.compareBoundaryPoints(Range.END_TO_START, nodeRange) <= 0;
  const startsAfterOrAtEnd = range.compareBoundaryPoints(Range.START_TO_END, nodeRange) >= 0;
  return !(endsBeforeOrAtStart || startsAfterOrAtEnd);
}

function unwrapTranslatable(span: HTMLElement) {
  const parent = span.parentNode;
  if (!parent) return;
  while (span.firstChild) {
    parent.insertBefore(span.firstChild, span);
  }
  parent.removeChild(span);
}

function toggleTranslatableForSelection(root: HTMLElement): "wrapped" | "unwrapped" | "noop" {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return "noop";
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return "noop";

  const spans = Array.from(root.querySelectorAll<HTMLElement>("span[data-ut='1']"));
  const intersected = spans.filter((span) => rangeIntersectsNode(range, span));
  if (intersected.length > 0) {
    intersected.forEach(unwrapTranslatable);
    root.normalize();
    return "unwrapped";
  }

  if (range.collapsed) return "noop";
  wrapSelectionAsTranslatable(root);
  root.normalize();
  return "wrapped";
}

function wrapSelectionAsTranslatable(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  if (range.collapsed || !root.contains(range.commonAncestorContainer)) return;

  const fragment = range.extractContents();
  const span = document.createElement("span");
  span.setAttribute("data-ut", "1");
  span.className = "ut";
  span.appendChild(fragment);
  range.insertNode(span);

  const caret = document.createRange();
  caret.setStartAfter(span);
  caret.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caret);
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement | null>(null);
  const [activeCommands, setActiveCommands] = React.useState<Record<Command, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    translatable: false,
  });

  React.useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const normalized = normalizeFromWire(value || "");
    if (el.innerHTML !== normalized) {
      el.innerHTML = normalized;
    }
  }, [value]);

  const emit = React.useCallback(() => {
    if (!editorRef.current) return;
    onChange(serializeToWire(editorRef.current.innerHTML));
  }, [onChange]);

  const refreshActiveCommands = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) {
      setActiveCommands({
        bold: false,
        italic: false,
        underline: false,
        insertUnorderedList: false,
        insertOrderedList: false,
        translatable: false,
      });
      return;
    }

    const range = sel.getRangeAt(0);
    const isCollapsed = range.collapsed;
    if (!editor.contains(range.commonAncestorContainer)) {
      setActiveCommands({
        bold: false,
        italic: false,
        underline: false,
        insertUnorderedList: false,
        insertOrderedList: false,
        translatable: false,
      });
      return;
    }

    const queryList = (cmd: "insertUnorderedList" | "insertOrderedList") => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };

    const queryInline = (cmd: "bold" | "italic" | "underline") => {
      try {
        return document.queryCommandState(cmd);
      } catch {
        return false;
      }
    };

    const hasTagUp = (tags: string[]) => {
      let node: Node | null = range.startContainer;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tagName = (node as Element).tagName;
          if (tags.includes(tagName)) return true;
        }
        if (node === editor) break;
        node = node.parentNode;
      }
      return false;
    };

    const findTagUp = (tag: "UL" | "OL") => {
      let node: Node | null = range.startContainer;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === tag) return true;
        if (node === editor) break;
        node = node.parentNode;
      }
      return false;
    };

    const isInsideTranslatable = () => {
      let node: Node | null = range.startContainer;
      while (node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === "SPAN" && el.hasAttribute("data-ut")) return true;
        }
        if (node === editor) break;
        node = node.parentNode;
      }
      return false;
    };

    setActiveCommands({
      bold: queryInline("bold") || (!isCollapsed && hasTagUp(["B", "STRONG"])),
      italic: queryInline("italic") || (!isCollapsed && hasTagUp(["I", "EM"])),
      underline: queryInline("underline") || (!isCollapsed && hasTagUp(["U"])),
      insertUnorderedList: queryList("insertUnorderedList") || findTagUp("UL"),
      insertOrderedList: queryList("insertOrderedList") || findTagUp("OL"),
      translatable: isInsideTranslatable(),
    });
  }, []);

  React.useEffect(() => {
    const onSelectionChange = () => refreshActiveCommands();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [refreshActiveCommands]);

  const applyCommand = (cmd: Command) => {
    if (disabled) return;
    editorRef.current?.focus();

    if (cmd === "translatable") {
      if (editorRef.current && isSelectionInside(editorRef.current)) {
        const result = toggleTranslatableForSelection(editorRef.current);
        if (result !== "noop") emit();
      }
      refreshActiveCommands();
      return;
    }

    document.execCommand(cmd, false);
    emit();
    refreshActiveCommands();
  };

  return (
    <div className={`${styles.richTextRoot} ${className ?? ""}`}>
      <div className={styles.richTextToolbar}>
        {COMMANDS.map((item) => (
          <div
            key={item.cmd}
            className={`${styles.richTextButton} ${activeCommands[item.cmd] ? styles.richTextButtonActive : ""}`}
            title={item.title}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              if (disabled) return;
              applyCommand(item.cmd);
            }}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                applyCommand(item.cmd);
              }
            }}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled ? "true" : "false"}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div
        ref={editorRef}
        className={styles.richTextEditor}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder || ""}
        onBlur={() => {
          emit();
          refreshActiveCommands();
        }}
        onInput={emit}
        onKeyUp={refreshActiveCommands}
        onMouseUp={refreshActiveCommands}
      />
    </div>
  );
}
