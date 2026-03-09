// src/services/ContentService.ts
import { ContentApi, ContentManagerApi, type MediaFileMeta } from "../api";
import { axiosInstance } from "../instances/axiosInstance.ts";
import {
    CreateTaskContentRequestContentTypeEnum,
    CreateTaskAnswerRequestAnswerTypeEnum,
} from "../api";
import { mediaService } from "./MediaService";

class ContentService {
    private contentApi: ContentApi;
    private managerApi: ContentManagerApi;

    get contentApiInstance() {
        return this.contentApi;
    }

    constructor() {
        this.contentApi = new ContentApi(undefined, undefined, axiosInstance);
        this.managerApi = new ContentManagerApi(undefined, undefined, axiosInstance);
    }
    async getAllCourses(): Promise<any[]> {
        return this.getCourses();
    }

    async getAllReports(params?: Record<string, any>): Promise<any[]> {
        return this.getReports(params);
    }

    async getReportById(reportId: string): Promise<any> {
        return this.getReport(reportId);
    }

    async getThemeById(themeId: string): Promise<any> {
        const { data } = await this.contentApi.contentThemesThemeIdGet(themeId);
        return data;
    }

    async getContentStats(): Promise<any> {
        const { data } = await this.contentApi.contentStatsGet();
        return data;
    }

    private mapFileTypeToContentType(fileType: string): CreateTaskContentRequestContentTypeEnum {
        switch (fileType.toUpperCase()) {
            case "AUDIO":
                return CreateTaskContentRequestContentTypeEnum.Audio;
            case "VIDEO":
                return CreateTaskContentRequestContentTypeEnum.Video;
            case "IMAGE":
                return CreateTaskContentRequestContentTypeEnum.Image;
            default:
                return CreateTaskContentRequestContentTypeEnum.Text;
        }
    }

    private mapAnswerTypeToBackend(answerType: string): CreateTaskAnswerRequestAnswerTypeEnum {
        switch (answerType) {
            case "SINGLE_CHOICE":
                return CreateTaskAnswerRequestAnswerTypeEnum.SingleChoiceShort;
            case "MULTI_CHOICE":
                return CreateTaskAnswerRequestAnswerTypeEnum.MultipleChoiceShort;
            case "ORDER_WORDS":
                return CreateTaskAnswerRequestAnswerTypeEnum.WordOrder;
            case "SELECT_WORDS":
                return CreateTaskAnswerRequestAnswerTypeEnum.WordSelection;
            default:
                return CreateTaskAnswerRequestAnswerTypeEnum.TextInput;
        }
    }

    async uploadMediaFile(file: File): Promise<MediaFileMeta> {
        const userId = localStorage.getItem("userId") || undefined;
        const formData = new FormData();
        formData.append("file", file);
        formData.append("fileName", file.name);
        formData.append("mimeType", file.type);
        formData.append("fileSize", String(file.size));

        let fileType = "CONTENT";
        if (file.type.startsWith("image/")) fileType = "IMAGE";
        else if (file.type.startsWith("audio/")) fileType = "AUDIO";
        else if (file.type.startsWith("video/")) fileType = "VIDEO";
        formData.append("fileType", fileType);

        return mediaService.uploadMediaWithMeta(formData, userId);
    }

    // ============ COURSES ============
    async getCourses(): Promise<any[]> {
        const { data } = await this.contentApi.contentCoursesGet();
        const courses = await Promise.all(
            (data || []).map(async (c: any) => ({
                id: c.id,
                name: c.name,
                description: c.description,
                authorUrl: c.authorUrl,
                language: c.language,
                isPublished: c.isPublished,
                courseId: c.courseId ?? null,
                themesCount: await this.getThemesCountByCourse(c.id),
                tasksCount: await this.getTasksCountByCourse(c.id),
                posterId: c.coursePoster ?? c.posterId ?? null,
            }))
        );
        return courses;
    }

    async getCourseById(courseId: string): Promise<any> {
        const { data: c } = await this.contentApi.contentCoursesCourseIdGet(courseId);
        return {
            id: c.id,
            name: c.name,
            description: c.description,
            authorUrl: c.authorUrl,
            language: c.language,
            isPublished: c.isPublished,
            courseId: c.courseId ?? null,
            themesCount: await this.getThemesCountByCourse(courseId),
            tasksCount: await this.getTasksCountByCourse(courseId),
            posterId: c.coursePoster ?? c.posterId ?? null,
        };
    }

    async createCourse(courseData: any): Promise<any> {
        const { data: c } = await this.managerApi.contentCoursesPost(courseData);
        return {
            id: c.id,
            name: c.name,
            description: c.description,
            authorUrl: c.authorUrl,
            language: c.language,
            isPublished: c.isPublished,
            courseId: c.courseId ?? courseData.courseId ?? null,
            sectionsCount: 0,
            themesCount: 0,
            tasksCount: 0,
            posterId: c.coursePoster ?? c.posterId ?? null,
        };
    }

    async updateCourse(courseId: string, courseData: any): Promise<any> {
        const { data } = await axiosInstance.put(`/content/courses/${courseId}`, courseData);
        return data;
    }

    async deleteCourse(courseId: string): Promise<void> {
        await this.managerApi.contentCoursesCourseIdDelete(courseId);
    }

    async importCourse(
        payload: unknown,
        options: { targetCourseId?: string; createIfMissing?: boolean; language?: string; addOnly?: boolean }
    ): Promise<any> {
        const { data } = await axiosInstance.post(`/content/courses/import`, payload, {
            params: { ...options },
        });
        return data;
    }

    async exportCourse(courseId: string, since?: string): Promise<any> {
        console.log(`[ContentService] Exporting course ${courseId}, since: ${since}`);
        const { data } = await axiosInstance.get(
            `/content/courses/${encodeURIComponent(courseId)}/export`,
            { params: { since }, responseType: "json" }
        );
        return data;
    }

    async cloneCourseStructure(
        sourceCourseId: string,
        options: { newLanguage: string; newCourseName?: string; copyTasks?: boolean }
    ): Promise<any> {
        const { data } = await axiosInstance.post(
            `/content/courses/${encodeURIComponent(sourceCourseId)}/clone`,
            {
                newLanguage: options.newLanguage,
                newCourseName: options.newCourseName,
                copyTasks: options.copyTasks ?? true
            }
        );
        return data;
    }

    // ============ THEMES ============
    async updateTheme(themeId: string, themeData: any): Promise<any> {
        const { data } = await this.managerApi.contentThemesThemeIdPut(themeId, themeData);
        return data;
    }

    async getThemeTree(themeId: string): Promise<any> {
        const { data } = await axiosInstance.get(`/content/themes/${themeId}/tree`);
        return data;
    }

    async getThemeTasks(themeId: string): Promise<any[]> {
        const { data } = await axiosInstance.get(`/content/themes/${themeId}/tasks`);
        return data || [];
    }

    async getThemeContents(themeId: string): Promise<any[]> {
        const { data } = await axiosInstance.get(`/content/themes/${themeId}/contents`);
        return data || [];
    }

    async deleteTheme(themeId: string): Promise<void> {
        await this.managerApi.contentThemesThemeIdDelete(themeId);
    }

    // ============ REPORTS ============
    async getReports(params?: Record<string, any>): Promise<any[]> {
        const { data } = await axiosInstance.get(`/content/reports`, { params });
        return data || [];
    }

    async getReport(reportId: string): Promise<any> {
        const { data } = await axiosInstance.get(`/content/reports/${reportId}`);
        return data;
    }

    async createReport(payload: any): Promise<any> {
        const { data } = await axiosInstance.post(`/content/reports`, payload);
        return data;
    }

    async deleteReport(reportId: string): Promise<void> {
        await this.managerApi.contentReportsReportIdDelete(reportId);
    }

    // ============ STATS ============
    async getTasksCountByCourse(courseId: string): Promise<number> {
        try {
            const response = await this.contentApi.contentStatsCourseCourseIdTasksCountGet(courseId);
            return Number(response.data) || 0;
        } catch (error) {
            console.error(`Ошибка получения количества задач курса ${courseId}:`, error);
            return 0;
        }
    }

    async getTasksCountBySection(sectionId: string): Promise<number> {
        try {
            const response = await this.contentApi.contentStatsSectionSectionIdTasksCountGet(sectionId);
            return Number(response.data) || 0;
        } catch (error) {
            console.error(`Ошибка получения количества задач секции ${sectionId}:`, error);
            return 0;
        }
    }

    async getTasksCountByTheme(themeId: string): Promise<number> {
        try {
            const response = await this.contentApi.contentStatsThemeThemeIdTasksCountGet(themeId);
            return Number(response.data) || 0;
        } catch (error) {
            try {
                const tasks = await this.getTasksByTheme(themeId);
                return Array.isArray(tasks) ? tasks.length : 0;
            } catch (inner) {
                console.error(`Ошибка получения количества задач темы ${themeId}:`, inner);
                return 0;
            }
        }
    }

    private async getThemesCountByCourse(_courseId: string): Promise<number> {
        // TODO: реализовать реальное вычисление через дерево тем
        return 0;
    }

    // ============ TASKS ============
    async deleteTask(taskId: string): Promise<void> {
        await this.managerApi.contentTasksTaskIdDelete(taskId);
    }

    async createTask(
        themeId: string,
        taskData: {
            name: string;
            question: string;
            taskType: string;
            instructions?: string;
            isTraining?: boolean;
            contents?: Array<{
                id: string;
                contentType: string;
                description?: string;
                transcription?: string;
                translation?: string;
                text?: string;
                file?: File;
                orderNum: number;
                contentId?: string;
            }>;
            answer?: {
                answerType: string;
                correctAnswer: any;
                options?: Array<{
                    id: string;
                    text: string;
                    isCorrect: boolean;
                    orderNum: number;
                }>;
                matchPairs?: Array<{
                    id: string;
                    leftItem: { type: string; content: string };
                    rightItem: { type: string; content: string };
                }>;
            };
        }
    ): Promise<unknown> {
        try {
            const existingTasks = await this.getTasksByTheme(themeId);
            const orderNum = Array.isArray(existingTasks) ? existingTasks.length + 1 : 1;

            const createTaskRequest = {
                themeId,
                name: taskData.name,
                question: taskData.question,
                taskType: taskData.taskType as import("../api").CreateTaskRequestTaskTypeEnum,
                instructions: taskData.instructions || "",
                isTraining: taskData.isTraining || false,
                orderNum,
            };

            const { data: createdTask } = await this.managerApi.contentTasksPost(createTaskRequest);

            for (const content of taskData.contents || []) {
                await this.managerApi.contentTasksTaskIdContentPost(createdTask.id, {
                    contentType: this.mapFileTypeToContentType(content.contentType),
                    description: content.description,
                    transcription: content.transcription,
                    translation: content.translation,
                    contentId: content.contentId,
                    orderNum: content.orderNum,
                });
            }

            if (taskData.answer) {
                if (taskData.answer.options?.length) {
                    for (const option of taskData.answer.options) {
                        await this.managerApi.contentTasksTaskIdOptionsPost(createdTask.id, {
                            optionText: option.text,
                            isCorrect: option.isCorrect,
                            orderNum: option.orderNum,
                        });
                    }
                    await this.managerApi.contentTasksTaskIdAnswerPost(createdTask.id, {
                        answerType: this.mapAnswerTypeToBackend(taskData.answer.answerType),
                        correctAnswer: taskData.answer.correctAnswer || {},
                    });
                } else if (taskData.answer.answerType === "TEXT_INPUT") {
                    await this.managerApi.contentTasksTaskIdAnswerPost(createdTask.id, {
                        answerType: CreateTaskAnswerRequestAnswerTypeEnum.TextInput,
                        correctAnswer: { text: taskData.answer.correctAnswer?.text || "" },
                    });
                } else if (taskData.answer.answerType === "MATCH_PAIRS" && taskData.answer.matchPairs?.length) {
                    const pairs = taskData.answer.matchPairs.map((pair) => ({
                        leftItem: pair.leftItem,
                        rightItem: pair.rightItem,
                    }));
                    await this.managerApi.contentTasksTaskIdAnswerPost(createdTask.id, {
                        answerType: "MATCH_PAIRS" as unknown as CreateTaskAnswerRequestAnswerTypeEnum,
                        correctAnswer: { pairs },
                    });
                }
            }

            return createdTask;
        } catch (error) {
            console.error("Ошибка создания задачи:", error);
            throw error;
        }
    }

    async getTasksByTheme(themeId: string): Promise<any[]> {
        try {
            const response = await this.contentApi.contentThemesThemeIdTasksGet(themeId);
            return response.data || [];
        } catch (error) {
            console.error(`Ошибка загрузки задач темы ${themeId}:`, error);
            return [];
        }
    }

    async getTaskById(taskId: string): Promise<any> {
        try {
            const response = await this.contentApi.contentTasksTaskIdGet(taskId);
            return response.data;
        } catch (error) {
            console.error(`Ошибка получения задачи ${taskId}:`, error);
            throw error;
        }
    }

    async updateTask(taskId: string, taskData: any): Promise<any> {
        try {
            const response = await this.managerApi.contentTasksTaskIdPut(taskId, taskData);
            return response.data;
        } catch (error) {
            console.error(`Ошибка обновления задачи ${taskId}:`, error);
            throw error;
        }
    }

    async getTaskWithDetails(taskId: string): Promise<any> {
        try {
            const response = await this.contentApi.contentTasksTaskIdGet(taskId);
            return response.data;
        } catch (error) {
            console.error(`Ошибка получения задачи ${taskId}:`, error);
            throw error;
        }
    }

    async createAnswerOption(
        taskId: string,
        option: {
            optionText?: string;
            optionAudioId?: string | null;
            isCorrect?: boolean;
            orderNum?: number;
        }
    ): Promise<any> {
        try {
            const payload = {
                optionText: option.optionText ?? "",
                optionAudioId: option.optionAudioId ?? undefined,
                isCorrect: option.isCorrect ?? false,
                orderNum: option.orderNum ?? 0,
            };
            const response = await this.managerApi.contentTasksTaskIdOptionsPost(taskId, payload);
            return response.data ?? response;
        } catch (error) {
            console.error(`Ошибка создания варианта задачи ${taskId}:`, error);
            throw error;
        }
    }

    async updateAnswerOption(
        taskId: string,
        optionId: string,
        updates: {
            optionText?: string;
            optionAudioId?: string | null;
            isCorrect?: boolean;
            orderNum?: number;
        }
    ): Promise<any> {
        try {
            const payload = {
                optionText: updates.optionText,
                optionAudioId: updates.optionAudioId ?? undefined,
                isCorrect: updates.isCorrect,
                orderNum: updates.orderNum,
            };
            const response = await this.managerApi.contentTasksTaskIdOptionsOptionIdPut(
                optionId,
                taskId,
                payload
            );
            return response.data ?? response;
        } catch (error) {
            console.error(`Ошибка обновления варианта ${optionId} задачи ${taskId}:`, error);
            throw error;
        }
    }

    async deleteAnswerOption(taskId: string, optionId: string): Promise<void> {
        try {
            await this.managerApi.contentTasksTaskIdOptionsOptionIdDelete(optionId, taskId);
        } catch (error) {
            console.error(`Ошибка удаления варианта ${optionId} задачи ${taskId}:`, error);
            throw error;
        }
    }
}

export default new ContentService();
