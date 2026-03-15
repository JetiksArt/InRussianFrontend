import React, { useState, type ReactNode } from "react";
import contentService from "../../services/ContentService.ts";
import taskService from "../../services/TaskService.ts";
import { mediaService } from "../../services/MediaService.ts";
import { ContentContext } from "./ContentContext.ts";
import type { TaskModel } from "../../components/content/task-editor/TaskModels.ts";
import type {
  UpdateTaskRequest,
  UpdateCourseRequest,
  UpdateSectionRequest,
  UpdateThemeRequest,
} from "../../api";
import { axiosInstance } from "../../instances/axiosInstance.ts";

export interface Course {
  id: string;
  name: string;
  description?: string;
  sectionsCount: number;
  themesCount: number;
  tasksCount: number;
  authorUrl?: string;
  language?: string;
  isPublished?: boolean;
  posterId?: string;
}

export interface Section {
  id: string;
  courseId: string;
  name: string;
  description?: string;
  themesCount: number;
  tasksCount: number;
}

export interface Theme {
  id: string;
  sectionId: string;
  name: string;
  description?: string;
  tasksCount: number;
}

export type TaskType =
  | "LISTEN_AND_CHOOSE"
  | "READ_AND_CHOOSE"
  | "LOOK_AND_CHOOSE"
  | "MATCH_AUDIO_TEXT"
  | "MATCH_TEXT_TEXT";

export type ContentType = "AUDIO" | "IMAGE" | "TEXT" | "VIDEO";

export type AnswerType =
  | "SINGLE_CHOICE"
  | "MULTI_CHOICE"
  | "ORDER_WORDS"
  | "SELECT_WORDS"
  | "MATCH_PAIRS"
  | "TEXT_INPUT";

export interface TaskContent {
  id?: string;
  contentId?: string,
  contentType: ContentType;
  description?: string;
  transcription?: string;
  translation?: string;
  orderNum?: number;
  text?: string;
  file?: File;
  url?: string;
}

export interface MatchPair {
  id: string;
  leftItem: {
    type: "TEXT" | "AUDIO";
    content: string;
  };
  rightItem: {
    type: "TEXT";
    content: string;
  };
}

export interface TaskAnswer {
  answerType: AnswerType;
  correctAnswer: any;
  options?: AnswerOption[];
  matchPairs?: MatchPair[];
}

export interface AnswerOption {
  id: string;
  text: string;
  isCorrect: boolean;
  orderNum: number;
}

export interface Task {
  id?: string;
  themeId?: string;
  name: string;
  taskType: TaskType;
  question: string;
  instructions?: string;
  isTraining: boolean;
  orderNum?: number;
  contents: TaskContent[];
  answer: TaskAnswer;
  answerOptions: AnswerOption[];
}

export interface ThemeTreeNode {
  theme: Theme;
  children: ThemeTreeNode[];
}

export interface ContentContextType {
  courses: Course[];
  sections: { [courseId: string]: Section[] };
  themes: { [sectionId: string]: Theme[] };
  themeTree: { [sectionId: string]: ThemeTreeNode[] };
  tasks: { [themeId: string]: Task[] };
  taskModels: { [themeId: string]: TaskModel[] };

  loadCourses: () => Promise<void>;
  loadSections: (courseId: string) => Promise<void>;
  loadThemes: (sectionId: string) => Promise<void>;
  loadThemeTree: (id: string, type: "course" | "theme") => Promise<void>;
  loadTasks: (themeId: string) => Promise<void>;
  loadTaskModels: (themeId: string) => Promise<void>;

  createCourse: (
    name: string,
    description?: string,
    authorUrl?: string,
    language?: string,
    isPublished?: boolean,
    posterId?: string | null
  ) => Promise<void>;
  createSection: (
    courseId: string,
    name: string,
    description?: string
  ) => Promise<void>;
  createTheme: (
    params: {
      courseId: string;
      parentThemeId?: string | null;
      name: string;
      description?: string;
      position?: number | null;
    }
  ) => Promise<any>;

  updateCourse: (
    id: string,
    name: string,
    description?: string,
    authorUrl?: string,
    language?: string,
    isPublished?: boolean,
    posterId?: string | null
  ) => Promise<void>;
  updateSection: (
    id: string,
    name: string,
    description?: string
  ) => Promise<void>;
  updateTheme: (
    id: string,
    name: string,
    description?: string
  ) => Promise<void>;

  deleteCourse: (id: string) => Promise<void>;
  deleteSection: (id: string) => Promise<void>;
  deleteTheme: (id: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTaskModel?: (id: string, themeId: string) => Promise<void>;

  createTask: (
    themeId: string,
    taskData: Omit<Task, "id" | "themeId">
  ) => Promise<Task>;
  updateTask: (
    taskId: string,
    taskData: Partial<Omit<Task, "id" | "themeId">>
  ) => Promise<Task>;
  uploadMediaFile: (file: File) => Promise<string>;

  getContentStats: () => Promise<unknown>;
  getTasksCountByCourse: (courseId: string) => Promise<number>;
  getTasksCountBySection: (sectionId: string) => Promise<number>;
  getTasksCountByTheme: (themeId: string) => Promise<number>;

  isLoadingTasks: boolean;
  isUploadingMedia: boolean;
  isLoadingCourses: boolean;
  isLoadingSections: boolean;
  isLoadingThemes: boolean;
}

const transformApiTaskToTask = (apiTask: any): Task => {
  return {
    id: apiTask.id,
    themeId: apiTask.themeId,
    name: apiTask.name,
    taskType: apiTask.taskType as TaskType,
    question: apiTask.question,
    instructions: apiTask.instructions,
    isTraining: apiTask.isTraining,
    orderNum: apiTask.orderNum,
    contents:
      apiTask.contents?.map((content: any) => ({
        id: content.id,
        contentType: content.contentType as ContentType,
        description: content.description,
        transcription: content.transcription,
        translation: content.translation,
        orderNum: content.orderNum,
        contentId: content.contentId 
      })) || [],
    answer: {
      answerType: (apiTask.answer?.answerType as AnswerType) || "SINGLE_CHOICE",
      correctAnswer: apiTask.answer?.correctAnswer || {},
    },
    answerOptions:
      apiTask.answerOptions?.map((option: any) => ({
        id: option.id,
        optionText: option.optionText,
        isCorrect: option.isCorrect,
        orderNum: option.orderNum,
      })) || [],
  };
};

export const ContentProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<{ [courseId: string]: Section[] }>(
    {}
  );
  const [themes, setThemes] = useState<{ [sectionId: string]: Theme[] }>({});
  const [themeTree, setThemeTree] = useState<{ [sectionId: string]: ThemeTreeNode[] }>({});
  // Load theme tree for a section
  // Load theme tree for a theme (root theme or course root)
  // Load theme tree for a course (top-level) or theme (sub-tree)
  const loadThemeTree = async (id: string, type: "course" | "theme") => {
    try {
      let resp;
      if (type === "course") {
        resp = await axiosInstance.get(`/content/courses/${id}/theme-tree`);
      } else {
        resp = await axiosInstance.get(`/content/themes/${id}/tree`);
      }
      console.log("THEME_DEBUG backend tree", {
        id,
        type,
        data: resp.data,
      });
      setThemeTree(prev => ({ ...prev, [id]: Array.isArray(resp.data) ? resp.data : [resp.data] }));
    } catch (error) {
      console.error("Ошибка загрузки дерева тем:", error);
      setThemeTree(prev => ({ ...prev, [id]: [] }));
    }
  };
  const [tasks, setTasks] = useState<{ [themeId: string]: Task[] }>({});
  const [taskModels, setTaskModels] = useState<{ [themeId: string]: TaskModel[] }>({});

  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [isLoadingSections, setIsLoadingSections] = useState(false);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);

  const loadCourses = async () => {
    setIsLoadingCourses(true);
    try {
      const apiCourses = await contentService.getAllCourses();
      setCourses(apiCourses);
    } catch (error) {
      console.error("Ошибка загрузки курсов:", error);
      setCourses([]);
    } finally {
      setIsLoadingCourses(false);
    }
  };

  const loadSections = async (courseId: string) => {
    setIsLoadingSections(true);
    try {
      const apiSections = await contentService.getSectionsByCourse(courseId);
      setSections((prev) => ({ ...prev, [courseId]: apiSections }));
    } catch (error) {
      console.error("Ошибка загрузки секций:", error);
      setSections((prev) => ({ ...prev, [courseId]: [] }));
    } finally {
      setIsLoadingSections(false);
    }
  };

  const loadThemes = async (sectionId: string) => {
    setIsLoadingThemes(true);
    try {
      const apiThemes = await contentService.getThemesBySection(sectionId);
      setThemes((prev) => ({ ...prev, [sectionId]: apiThemes }));
    } catch (error) {
      console.error("Ошибка загрузки тем:", error);
      setThemes((prev) => ({ ...prev, [sectionId]: [] }));
    } finally {
      setIsLoadingThemes(false);
    }
  };

  const loadTasks = async (themeId: string) => {
    setIsLoadingTasks(true);
    try {
      const apiTasks = await contentService.getTasksByTheme(themeId);
      const transformedTasks: Task[] = apiTasks.map(transformApiTaskToTask);
      setTasks((prev) => ({ ...prev, [themeId]: transformedTasks }));
    } catch (error) {
      console.error("Ошибка загрузки задач:", error);
      setTasks((prev) => ({ ...prev, [themeId]: [] }));
    } finally {
      setIsLoadingTasks(false);
    }
  };

  // Placeholder: загрузка TaskModel (новые задания редактора)
  const loadTaskModels = async (themeId: string) => {
    setIsLoadingTasks(true);
    try {
      const resp = await axiosInstance.get<TaskModel[]>("/task/theme/" + themeId)
      const items: TaskModel[] = resp.data;
      setTaskModels((prev) => ({ ...prev, [themeId]: items }));
    } catch (error) {
      console.error("Ошибка загрузки TaskModel:", error);
      setTaskModels((prev) => ({ ...prev, [themeId]: [] }));
    } finally {
      setIsLoadingTasks(false);
    }
  };

  const createCourse = async (
    name: string,
    description?: string,
    authorUrl?: string,
    language?: string,
    isPublished?: boolean,
    posterId?: string | null
  ) => {
    try {
      const defaultAuthorUrl =
        authorUrl ||
        localStorage.getItem("userId") ||
        "0070ecd4-fa1f-4007-bde7-a5399b789fe1";

      const courseData: any = {
        name,
        description: description || "",
        authorUrl: defaultAuthorUrl,
        language: language || "RUSSIAN",
        isPublished: isPublished ?? false,
        coursePoster: posterId ?? null,
      };
      const newCourse = await contentService.createCourse(courseData);
      setCourses((prev) => [...prev, newCourse]);
    } catch (error) {
      console.error("Ошибка создания курса:", error);
      throw error;
    }
  };

  const createSection = async (
    courseId: string,
    name: string,
    description?: string
  ) => {
    try {
      const newSection = await contentService.createSection(
        courseId,
        name,
        description || ""
      );
      setSections((prev) => ({
        ...prev,
        [courseId]: [...(prev[courseId] || []), newSection],
      }));
    } catch (error) {
      console.error("Ошибка создания секции:", error);
      throw error;
    }
  };

  // Updated: createTheme to match backend CreateThemeRequest
  const createTheme = async (
    params: {
      courseId: string;
      parentThemeId?: string | null;
      name: string;
      description?: string;
      position?: number | null;
    }
  ) => {
    try {
      // Send request to backend using correct model and route
      const requestData = {
        courseId: params.courseId,
        parentThemeId: params.parentThemeId ?? null,
        name: params.name,
        description: params.description ?? "",
        position: params.position ?? null,
      };
      // API route: /content/themes (POST)
      const resp = await axiosInstance.post("/content/themes", requestData);
      const newTheme = resp.data;
      // Update themeTree (if needed) or reload courses/themes
      await loadCourses();
      // Optionally, update themeTree or themes state here if needed
      return newTheme;
    } catch (error) {
      console.error("Ошибка создания темы:", error);
      throw error;
    }
  };

  const updateCourse = async (
    id: string,
    name: string,
    description?: string,
    authorUrl?: string,
    language?: string,
    isPublished?: boolean,
    posterId?: string | null
  ) => {
    try {
      const courseData: UpdateCourseRequest = { 
        name, 
        description,
        authorUrl,
        language,
        isPublished,
        coursePoster: posterId
      };
      const apiCourse = await contentService.updateCourse(id, courseData);

      // Don't try to update old course state structure, just refresh the data
      // The courses will be updated when loadCourses is called
      console.log('Course updated:', apiCourse);
    } catch (error) {
      console.error("Ошибка обновления курса:", error);
      throw error;
    }
  };

  const updateSection = async (
    id: string,
    name: string,
    description?: string
  ) => {
    try {
      const sectionData: UpdateSectionRequest = { name, description };
      const apiSection = await contentService.updateSection(id, sectionData);

      const updatedSection: Section = {
        id: apiSection.id,
        courseId: apiSection.courseId,
        name: apiSection.name,
        description: apiSection.description,
        themesCount: 0,
        tasksCount: await contentService.getTasksCountBySection(id),
      };

      setSections((prev) => {
        const newSections = { ...prev };
        Object.keys(newSections).forEach((courseId) => {
          newSections[courseId] = newSections[courseId].map((section) =>
            section.id === id ? updatedSection : section
          );
        });
        return newSections;
      });
    } catch (error) {
      console.error("Ошибка обновления секции:", error);
      throw error;
    }
  };

  const updateTheme = async (
    id: string,
    name: string,
    description?: string
  ) => {
    try {
      const themeData: UpdateThemeRequest = { 
        name, 
        description,
        // Include position and parentThemeId as per the UpdateThemeRequest schema
        // These will be null/undefined if not specified, which the backend handles
      };
      const apiTheme = await contentService.updateTheme(id, themeData);

      // Don't try to update old theme state structure, just refresh the data
      // The theme tree will be updated when loadThemeTree is called
      console.log('Theme updated:', apiTheme);
    } catch (error) {
      console.error("Ошибка обновления темы:", error);
      throw error;
    }
  };

  const deleteCourse = async (id: string) => {
    try {
      await axiosInstance.delete(`/content/courses/${id}`);
      // Don't try to update old course state structure, just log success
      // The courses will be updated when loadCourses is called from the component
      console.log('Course deleted:', id);
    } catch (error) {
      console.error("Ошибка удаления курса:", error);
      throw error;
    }
  };

  const deleteSection = async (id: string) => {
    try {
  await axiosInstance.delete(`/content/sections/${id}`);
      setSections((prev) => {
        const newSections = { ...prev };
        Object.keys(newSections).forEach((courseId) => {
          newSections[courseId] = newSections[courseId].filter(
            (section) => section.id !== id
          );
        });
        return newSections;
      });
    } catch (error) {
      console.error("Ошибка удаления секции:", error);
      throw error;
    }
  };

  const deleteTheme = async (id: string) => {
    try {
      await axiosInstance.delete(`/content/themes/${id}`);
      // Don't try to update old theme state structure, just log success
      // The theme tree will be updated when loadThemeTree is called from the component
      console.log('Theme deleted:', id);
    } catch (error) {
      console.error("Ошибка удаления темы:", error);
      throw error;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await axiosInstance.delete("/task/" + id);
      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((themeId) => {
          newTasks[themeId] = newTasks[themeId].filter(
            (task) => task.id !== id
          );
        });
        return newTasks;
      });
    } catch (error) {
      console.error("Ошибка удаления задачи:", error);
      throw error;
    }
  };

  const deleteTaskModel = async (id: string, themeId: string) => {
    try {
      await axiosInstance.delete("/task/" + id);
      setTaskModels(prev => {
        const next = { ...prev };
        if (next[themeId]) next[themeId] = next[themeId].filter(t => t.id !== id);
        return next;
      });
    } catch (error) {
      console.error('Ошибка удаления TaskModel:', error);
      throw error;
    }
  };

  const createTask = async (themeId: string, taskData: any) => {
    try {
      console.log("Отправляемые данные contents:", taskData);
  const createdTask: any = await contentService.createTask(themeId, taskData);
      // Если нужно получить полные данные задачи после создания:
      const fullTask = await contentService.getTaskById(createdTask.id);
      // Обновляем состояние, если нужно
      return fullTask;
    } catch (error) {
      console.error("Ошибка создания задачи:", error);
      throw error;
    }
  };

  const updateTask = async (
    taskId: string,
    taskData: Partial<Omit<Task, "id" | "themeId">>
  ): Promise<Task> => {
    try {
      const updateRequest: UpdateTaskRequest = {};
      if (taskData.name) updateRequest.name = taskData.name;
      if (taskData.question) updateRequest.question = taskData.question;
      if (taskData.instructions !== undefined)
        updateRequest.instructions = taskData.instructions;
      if (taskData.isTraining !== undefined)
        updateRequest.isTraining = taskData.isTraining;
      if (taskData.orderNum !== undefined)
        updateRequest.orderNum = taskData.orderNum;

      const apiTask = await taskService.updateTask(taskId, updateRequest);
      const updatedTask = transformApiTaskToTask(apiTask);

      setTasks((prev) => {
        const newTasks = { ...prev };
        Object.keys(newTasks).forEach((themeId) => {
          newTasks[themeId] = newTasks[themeId].map((task) =>
            task.id === taskId ? updatedTask : task
          );
        });
        return newTasks;
      });

      return updatedTask;
    } catch (error) {
      console.error("Ошибка обновления задачи:", error);
      throw error;
    }
  };

  const uploadMediaFile = async (file: File): Promise<string> => {
    setIsUploadingMedia(true);
    try {
      const userId = localStorage.getItem("userId") || undefined;
      const formData = new FormData();
      formData.append("file", file);
      const mediaInfo = await mediaService.uploadMediaWithMeta(
        formData,
        userId
      );
      return mediaInfo.mediaId;
    } catch (error) {
      console.error("Ошибка загрузки медиафайла:", error);
      throw error;
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const getContentStats = async (): Promise<unknown> => {
    try {
      return await contentService.getContentStats();
    } catch (error) {
      console.error("Ошибка получения статистики:", error);
      throw error;
    }
  };

  const getTasksCountByCourse = async (courseId: string): Promise<number> => {
    try {
      return await contentService.getTasksCountByCourse(courseId);
    } catch (error) {
      console.error("Ошибка получения количества задач курса:", error);
      return 0;
    }
  };

  const getTasksCountBySection = async (sectionId: string): Promise<number> => {
    try {
      return await contentService.getTasksCountBySection(sectionId);
    } catch (error) {
      console.error("Ошибка получения количества задач секции:", error);
      return 0;
    }
  };

  const getTasksCountByTheme = async (themeId: string): Promise<number> => {
    try {
      return await contentService.getTasksCountByTheme(themeId);
    } catch (error) {
      console.error("Ошибка получения количества задач темы:", error);
      return 0;
    }
  };

  return (
    <ContentContext.Provider
      value={{
        courses,
        sections,
        themes,
        themeTree,
        tasks,
        taskModels,
        loadCourses,
        loadSections,
        loadThemes,
        loadThemeTree,
        loadTasks,
        loadTaskModels,
        createCourse,
        createSection,
        createTheme,
        updateCourse,
        updateSection,
        updateTheme,
        deleteCourse,
        deleteSection,
        deleteTheme,
        deleteTask,
        deleteTaskModel,
        createTask,
        updateTask,
        uploadMediaFile,
        getContentStats,
        getTasksCountByCourse,
        getTasksCountBySection,
        getTasksCountByTheme,
        isLoadingTasks,
        isUploadingMedia,
        isLoadingCourses,
        isLoadingSections,
        isLoadingThemes,
      }}
    >
      {children}
    </ContentContext.Provider>
  );
};
