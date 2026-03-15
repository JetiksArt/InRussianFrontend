import axios from "axios";

export const API_ERROR_EVENT = "app:api-error";

function pickMessageFromData(data: unknown): string | null {
    if (!data) return null;
    if (typeof data === "string") {
        const text = data.trim();
        return text || null;
    }
    if (typeof data !== "object") return null;

    const record = data as Record<string, unknown>;
    const direct =
        (typeof record.message === "string" && record.message)
        || (typeof record.error === "string" && record.error)
        || (typeof record.details === "string" && record.details)
        || (typeof record.code === "string" && record.code);

    if (direct) return direct;

    if (Array.isArray(record.details)) {
        const items = record.details
            .map((item) => {
                if (!item || typeof item !== "object") return null;
                const row = item as Record<string, unknown>;
                const field = typeof row.field === "string" ? row.field : "";
                const message = typeof row.message === "string" ? row.message : "";
                if (!field && !message) return null;
                return field ? `${field}: ${message}`.trim() : message;
            })
            .filter((item): item is string => Boolean(item));
        if (items.length) return items.join("\n");
    }

    return null;
}

function fallbackByStatus(status?: number): string {
    switch (status) {
        case 400:
            return "Некорректный запрос.";
        case 401:
            return "Сессия истекла. Войдите снова.";
        case 403:
            return "Недостаточно прав для этого действия.";
        case 404:
            return "Запрошенные данные не найдены.";
        case 409:
            return "Конфликт данных. Проверьте, не существует ли такой объект уже.";
        case 422:
            return "Данные не прошли проверку.";
        case 500:
            return "Ошибка сервера. Попробуйте позже.";
        default:
            return "Произошла ошибка.";
    }
}

export function getApiErrorMessage(error: unknown, fallback = "Произошла ошибка."): string {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const fromData = pickMessageFromData(error.response?.data);
        return fromData || fallbackByStatus(status) || fallback;
    }

    if (error instanceof Error) {
        const forbiddenMatch = error.message.match(/\b403\b/);
        const unauthorizedMatch = error.message.match(/\b401\b/);
        if (forbiddenMatch) return fallbackByStatus(403);
        if (unauthorizedMatch) return fallbackByStatus(401);
        return error.message || fallback;
    }

    return fallback;
}

export function emitApiError(message: string) {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, { detail: message }));
}
