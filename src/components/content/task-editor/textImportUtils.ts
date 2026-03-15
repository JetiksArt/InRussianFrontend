import type {
    ContentItem,
    GapWithVariantModel,
    Sentence,
    StressWordModel,
    TableCellModel,
    TableRowModel,
    TaskBody,
} from "./TaskModels";

type ParseResult = {
    body: TaskBody;
    message: string;
};

type ChoiceOption = [string, boolean];

const INLINE_GAP_RE = /(\[[^\]]+\]|\([^)]+\))/g;
const PLACEHOLDER_RE = /(?:\.{2,}|_{2,}|…{2,})/;
const COMBINING_ACUTE = "\u0301";

function normalizeLines(source: string): string[] {
    return source
        .replace(/\r/g, "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

function countWords(text: string): number {
    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
}

function splitPairLine(line: string): [string, string] | null {
    const explicit = line.match(/^(.*?)\s*(?:=>|->|=|\|)\s*(.*?)$/);
    if (explicit && explicit[1].trim() && explicit[2].trim()) {
        return [explicit[1].trim(), explicit[2].trim()];
    }

    const spaced = line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
    if (spaced.length >= 2) {
        return [spaced[0], spaced.slice(1).join(" ")];
    }

    return null;
}

function parseContentBlocks(source: string): ParseResult {
    const raw = source.replace(/\r/g, "").trim();
    if (!raw) {
        return {
            body: {type: "ContentBlocks", items: [{text: ""}]},
            message: "Текст пустой, добавлен один пустой блок.",
        };
    }

    const sections = raw.split(/\n\s*\n+/);
    const items: ContentItem[] = sections
        .map((section) => section.trim())
        .filter(Boolean)
        .map((text) => {
            if (/^TEXT\s*:/i.test(text)) {
                return {text: text.replace(/^TEXT\s*:/i, "").trim()};
            }
            return {text};
        });

    return {
        body: {type: "ContentBlocks", items: items.length ? items : [{text: raw}]},
        message: "Текст разбит на контент-блоки.",
    };
}

function parseTextConnectTask(source: string): ParseResult {
    const pairs = normalizeLines(source)
        .map(splitPairLine)
        .filter((pair): pair is [string, string] => Boolean(pair));

    return {
        body: {type: "TextConnectTask", variant: pairs.length ? pairs : [["", ""]]},
        message: pairs.length
            ? "Найдены пары для соединения."
            : "Не удалось распознать пары. Используйте формат «лево = право».",
    };
}

function parseInlineGaps(line: string): Sentence {
    const gaps: Sentence["gaps"] = [];
    let text = "";
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = INLINE_GAP_RE.exec(line)) !== null) {
        const before = line.slice(lastIndex, match.index);
        text += before;
        const answer = match[0].slice(1, -1).trim();
        const indexWord = countWords(text);
        text += "_____";
        gaps.push({correctWord: answer, indexWord});
        lastIndex = match.index + match[0].length;
    }

    text += line.slice(lastIndex);

    return {
        label: "",
        text: text.trim(),
        gaps,
    };
}

function parseTrailingGap(line: string): Sentence | null {
    const trailing = line.match(/^(.*?)(?:\s+[\[(]([^)\\\]]+)[)\]])$/);
    if (!trailing) return null;

    const sentence = trailing[1].trim();
    const answer = trailing[2].trim();
    if (!sentence || !answer || !PLACEHOLDER_RE.test(sentence)) return null;

    const marker = sentence.match(PLACEHOLDER_RE);
    if (!marker || marker.index === undefined) return null;

    const before = sentence.slice(0, marker.index);
    const replaced = sentence.replace(PLACEHOLDER_RE, "_____");

    return {
        label: "",
        text: replaced,
        gaps: [{correctWord: answer, indexWord: countWords(before)}],
    };
}

function parseTextInputTask(source: string): ParseResult {
    const sentences: Sentence[] = [];

    for (const line of normalizeLines(source)) {
        if (INLINE_GAP_RE.test(line)) {
            INLINE_GAP_RE.lastIndex = 0;
            const parsed = parseInlineGaps(line);
            if (parsed.gaps.length) {
                sentences.push(parsed);
                continue;
            }
        }

        const trailing = parseTrailingGap(line);
        if (trailing) {
            sentences.push(trailing);
        }
    }

    return {
        body: {type: "TextInputTask", task: sentences.length ? sentences : [{label: "", text: "", gaps: []}]},
        message: sentences.length
            ? "Пропуски распознаны."
            : "Не удалось распознать пропуски. Используйте формат «Текст с [ответом]» или «Текст ..... (ответ)».",
    };
}

function parseTextInputWithVariantTask(source: string): ParseResult {
    const raw = source.replace(/\r/g, "").trim();
    const textParts: string[] = [];
    const gaps: GapWithVariantModel[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = /\{([^{}]+)\}/g;

    while ((match = regex.exec(raw)) !== null) {
        const before = raw.slice(lastIndex, match.index);
        textParts.push(before);

        const variants = match[1]
            .split("|")
            .map((part) => part.trim())
            .filter(Boolean);
        const correctRaw = variants.find((item) => item.startsWith("*")) ?? variants[0] ?? "";
        const normalizedVariants = variants.map((item) => item.replace(/^\*/, "").trim()).filter(Boolean);
        const correctVariant = correctRaw.replace(/^\*/, "").trim();

        gaps.push({
            indexWord: countWords(textParts.join("") + before),
            variants: normalizedVariants,
            correctVariant,
        });

        textParts.push("_____");
        lastIndex = match.index + match[0].length;
    }

    textParts.push(raw.slice(lastIndex));
    const text = textParts.join("").trim();

    return {
        body: {
            type: "TextInputWithVariantTask",
            task: {
                label: "",
                text,
                gaps: gaps.length ? gaps : [{indexWord: 0, variants: [""], correctVariant: ""}],
            },
        },
        message: gaps.length
            ? "Пропуски с вариантами распознаны."
            : "Не удалось распознать варианты. Используйте формат «{вариант1|*правильный|вариант3}».",
    };
}

type ChoiceParseResult = {
    options: ChoiceOption[];
};

function parseChoiceBlock(source: string): ChoiceParseResult {
    const lines = normalizeLines(source);
    const options: ChoiceOption[] = [];

    for (const line of lines) {
        const optionMatch = line.match(/^(?:[\-*+]|[0-9]+[.)]|[A-Za-zА-Яа-я][.)]|\[(?:x|X| )\])\s*(.+)$/);
        if (!optionMatch) continue;
        const isCorrect = /^\s*(?:\*|\+|\[x\]|\[X\])/.test(line);
        options.push([optionMatch[1].trim(), isCorrect]);
    }

    return {options};
}

function parseSelectWordsTask(source: string): ParseResult {
    const {options} = parseChoiceBlock(source);
    const variants: ChoiceOption[] = options.length ? options : [["", false]];

    return {
        body: {
            type: "SelectWordsTask",
            task: {
                audio: "",
                variants,
            },
        },
        message: options.length
            ? "Варианты ответа распознаны."
            : "Не удалось распознать варианты. Используйте строки вида «* правильный вариант» и «- обычный вариант».",
    };
}

function parseConstructSentenceTask(source: string): ParseResult {
    const sentence = normalizeLines(source).join(" ").trim();
    const variants = sentence
        .replace(/[.,!?;:]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    return {
        body: {
            type: "ConstructSentenceTask",
            task: {
                audio: null,
                variants: variants.length ? variants : [""],
            },
        },
        message: variants.length
            ? "Предложение разбито на слова в правильном порядке."
            : "Не удалось распознать предложение.",
    };
}

function parseStressWord(raw: string): StressWordModel | null {
    const line = raw.trim();
    if (!line) return null;

    const docxPattern = line.match(/^(.+?)\s*[-–]\s*([А-Яа-яЁёA-Za-z-]+)(?:\s*\([^)]*\))?$/);
    if (docxPattern) {
        const word = docxPattern[2].trim();
        if (word) {
            return {
                word,
                stressIndex: 0,
            };
        }
    }

    const acuteIndex = line.indexOf(COMBINING_ACUTE);
    if (acuteIndex > 0) {
        const word = line.replaceAll(COMBINING_ACUTE, "");
        return {
            word,
            stressIndex: acuteIndex - 1,
        };
    }

    const apostropheIndex = line.indexOf("'");
    if (apostropheIndex > 0) {
        const word = line.replace("'", "");
        return {
            word,
            stressIndex: apostropheIndex - 1,
        };
    }

    return null;
}

function parseSetTheStressTask(source: string): ParseResult {
    const lines = normalizeLines(source);
    const words = lines
        .map(parseStressWord)
        .filter((item): item is StressWordModel => Boolean(item));

    const hasDocumentLikeLines = lines.some((line) =>
        /^.+?\s*[-–]\s*[А-Яа-яЁёA-Za-z-]+(?:\s*\([^)]*\))?$/.test(line),
    );

    return {
        body: {type: "SetTheStressTask", task: words.length ? words : [{word: "", stressIndex: 0}]},
        message: words.length
            ? hasDocumentLikeLines
                ? "Слова из документного формата распознаны, но ударение нужно проверить вручную."
                : "Слова с ударением распознаны."
            : "Не удалось распознать ударение. Используйте формат «рабо́та», «рабо'та» или «ра-бо-та - работа».",
    };
}

function parseTableCell(raw: string): TableCellModel {
    const trimmed = raw.trim();
    const writable = trimmed.match(/^\[(.*)\]$/);
    if (!writable) {
        return {
            type: "READONLY",
            prefix: trimmed,
            placeholder: null,
            suffix: "",
            answer: null,
        };
    }

    const payload = writable[1].trim();
    const withPlaceholder = payload.match(/^(.*?)=>\s*(.*?)$/);
    if (withPlaceholder) {
        return {
            type: "WRITABLE",
            prefix: "",
            placeholder: withPlaceholder[1].trim(),
            suffix: "",
            answer: withPlaceholder[2].trim(),
        };
    }

    return {
        type: "WRITABLE",
        prefix: "",
        placeholder: "",
        suffix: "",
        answer: payload,
    };
}

function parseTableTask(source: string): ParseResult {
    const rows: TableRowModel[] = normalizeLines(source)
        .filter((line) => line.includes("|"))
        .map((line) => ({
            cells: line.split("|").map(parseTableCell),
        }))
        .filter((row) => row.cells.length >= 2);

    return {
        body: {
            type: "TableTask",
            task: rows.length
                ? rows
                : [{cells: [{type: "READONLY", prefix: "", placeholder: null, suffix: "", answer: null}, {type: "WRITABLE", prefix: "", placeholder: "", suffix: "", answer: ""}]}],
        },
        message: rows.length
            ? "Таблица распознана."
            : "Не удалось распознать таблицу. Используйте формат «текст | [ответ]».",
    };
}

export function getImportHelpText(bodyType: TaskBody["type"]): string {
    switch (bodyType) {
        case "ContentBlocks":
            return [
                "Обычные абзацы превратятся в текстовые блоки.",
                "Можно и явно:",
                "TEXT: Заголовок",
            ].join("\n");
        case "TextConnectTask":
            return [
                "Одна пара на строку:",
                "Как вас зовут? = Меня зовут Батыр",
                "7 января = Рождество Христово",
            ].join("\n");
        case "TextInputTask":
            return [
                "Вариант 1:",
                "Как вас [зовут]?",
                "",
                "Вариант 2:",
                "Как вас .....? (зовут)",
            ].join("\n");
        case "TextInputWithVariantTask":
            return [
                "Используйте фигурные скобки для пропуска с вариантами:",
                "Как вас {*зовут|пишут|читают}?",
                "",
                "Правильный вариант помечайте *.",
            ].join("\n");
        case "ConstructSentenceTask":
            return [
                "Вставьте готовое предложение:",
                "Я живу в Москве.",
                "",
                "Оно разобьётся на слова в правильном порядке.",
            ].join("\n");
        case "SelectWordsTask":
            return [
                "* правильный вариант",
                "- обычный вариант",
                "- ещё вариант",
            ].join("\n");
        case "SetTheStressTask":
            return [
                "По одному слову на строку:",
                "рабо́та",
                "хорошо́",
                "",
                "или:",
                "рабо'та",
                "",
                "или формат из документов:",
                "ра-бо-та - работа",
                "Ян-варь - январь",
            ].join("\n");
        case "TableTask":
            return [
                "Одна строка = одна строка таблицы.",
                "Январь | [1]",
                "Февраль | [2]",
                "",
                "С placeholder:",
                "Месяц | [Введите число=>1]",
            ].join("\n");
        default:
            return "Для этого типа текстовый конвертер отключён.";
    }
}

export function canImportFromText(bodyType: TaskBody["type"]): boolean {
    return bodyType === "ContentBlocks"
        || bodyType === "TextConnectTask"
        || bodyType === "TextInputTask"
        || bodyType === "TextInputWithVariantTask"
        || bodyType === "ConstructSentenceTask"
        || bodyType === "SelectWordsTask"
        || bodyType === "SetTheStressTask"
        || bodyType === "TableTask";
}

export function parseImportedTaskText(bodyType: TaskBody["type"], source: string): ParseResult {
    switch (bodyType) {
        case "ContentBlocks":
            return parseContentBlocks(source);
        case "TextConnectTask":
            return parseTextConnectTask(source);
        case "TextInputTask":
            return parseTextInputTask(source);
        case "TextInputWithVariantTask":
            return parseTextInputWithVariantTask(source);
        case "ConstructSentenceTask":
            return parseConstructSentenceTask(source);
        case "SelectWordsTask":
            return parseSelectWordsTask(source);
        case "SetTheStressTask":
            return parseSetTheStressTask(source);
        case "TableTask":
            return parseTableTask(source);
        default:
            return {
                body: {type: "ContentBlocks", items: [{text: source.trim()}]},
                message: "Для этого типа текстовый конвертер отключён.",
            };
    }
}
