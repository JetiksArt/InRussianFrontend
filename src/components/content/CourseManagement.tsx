import React, { useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import { axiosInstance } from "../../instances/axiosInstance";
import { useContent } from "../../context/content/UseContent.ts";
import { CreateEditModal } from "./CreateEditModal";
import TaskEditorModal from "./task-editor/TaskEditorModal.tsx";
import { taskTypesToRu } from './task-editor/TaskModels';
import type { TaskModel } from "./task-editor/TaskModels";
import contentService from "../../services/ContentService";
import { getApiErrorMessage } from "../../utils/apiError";


// New types for tree structure
export type ThemeTreeNode = {
    theme: any;
    children: ThemeTreeNode[];
};

const compareTaskModels = (a: TaskModel, b: TaskModel): number =>
    (a.position ?? 0) - (b.position ?? 0);

const updateThemePositionApi = async (theme: any, position: number) => {
    const payload = {
        name: theme.name,
        description: theme.description ?? "",
        position,
    };
    try {
        return await axiosInstance.put(`/content/themes/${theme.id}`, payload);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.warn(
                "THEME_DEBUG reorder attempt failed\n" +
                JSON.stringify(
                    {
                        id: theme.id,
                        name: theme.name,
                        attempt: "position-only",
                        status: error.response?.status,
                        payload,
                        response: error.response?.data,
                    },
                    null,
                    2,
                ),
            );
        }
        throw error;
    }
};

const getTaskTypeArray = (task: TaskModel): string[] =>
    Array.isArray(task.taskType) ? task.taskType : [];

const updateTaskPositionApi = async (task: TaskModel, themeId: string, position: number) => {
    const attempts = [
        {
            label: "minimal",
            payload: {
                themeId,
                position,
            },
        },
        {
            label: "full-spec",
            payload: {
                themeId,
                taskBody: task.taskBody,
                taskTypes: getTaskTypeArray(task),
                question: task.question ?? null,
                position,
            },
        },
    ];

    let lastError: unknown;

    for (const attempt of attempts) {
        try {
            return await axiosInstance.put(`/task/${task.id}`, attempt.payload);
        } catch (error) {
            lastError = error;
            if (axios.isAxiosError(error)) {
                console.warn(
                    "TASK_DEBUG reorder attempt failed\n" +
                    JSON.stringify(
                        {
                            id: task.id,
                            attempt: attempt.label,
                            status: error.response?.status,
                            payload: attempt.payload,
                            response: error.response?.data,
                        },
                        null,
                        2,
                    ),
                );
            }
        }
    }

    throw lastError;
};

interface ThemeTreeNodeComponentProps {
    node: ThemeTreeNode;
    courseId: string;
    siblingThemes: any[];
    expandedThemes: string[];
    onThemeClick: (id: string) => void;
    openModal: (type: "course" | "section" | "theme", parentId?: string | null, editItem?: any, courseId?: string) => void;
    openTaskEditor: (themeId: string, themeName: string, task?: TaskModel | null) => void;
    taskModels: Record<string, TaskModel[]>;
    taskOverrides: Record<string, TaskModel[]>;
    deleteTaskModel: any;
    themeTaskCounts: {[themeId: string]: number};
    handleDeleteTask: (taskId: string, themeId: string) => void;
    taskRefreshTrigger: number; // Add this to force task list refresh
    handleDeleteTheme: (theme: any) => void; // Add this to handle theme deletion
    moveTheme: (theme: any, siblingThemes: any[], courseId: string, direction: -1 | 1) => Promise<void>;
    moveTask: (themeId: string, tasks: TaskModel[], task: TaskModel, direction: -1 | 1) => Promise<void>;
    reorderThemes: (courseId: string, siblingThemes: any[], draggedThemeId: string, targetThemeId: string) => Promise<void>;
    reorderTasks: (themeId: string, tasks: TaskModel[], draggedTaskId: string, targetTaskId: string) => Promise<void>;
    draggedThemeId: string | null;
    setDraggedThemeId: React.Dispatch<React.SetStateAction<string | null>>;
    draggedTaskId: string | null;
    setDraggedTaskId: React.Dispatch<React.SetStateAction<string | null>>;
    movingThemeId: string | null;
    movingTaskId: string | null;
}

const ThemeTreeNodeComponent: React.FC<ThemeTreeNodeComponentProps> = (props) => {
    const {
        node,
        courseId,
        siblingThemes,
        expandedThemes,
        onThemeClick,
        openModal,
        openTaskEditor,
        taskModels,
        taskOverrides,
        deleteTaskModel,
        themeTaskCounts,
        handleDeleteTask,
        taskRefreshTrigger,
        handleDeleteTheme,
        moveTheme,
        moveTask,
        reorderThemes,
        reorderTasks,
        draggedThemeId,
        setDraggedThemeId,
        draggedTaskId,
        setDraggedTaskId,
        movingThemeId,
        movingTaskId,
    } = props;
    const theme = node.theme;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedThemes.includes(theme.id);
    const [tasks, setTasks] = useState<TaskModel[]>([]);
    const [dragOverThemeId, setDragOverThemeId] = useState<string | null>(null);
    const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
    const orderedChildren = [...node.children];
    const orderedTasks = [...(taskOverrides[theme.id] ?? taskModels[theme.id] ?? tasks)].sort(compareTaskModels);
    const themeIndex = siblingThemes.findIndex((item) => item.id === theme.id);
    const handleThemeDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        setDraggedThemeId(theme.id);
        event.dataTransfer.setData("application/x-theme-id", theme.id);
        event.dataTransfer.effectAllowed = "move";
    };
    const handleThemeDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        if (!draggedThemeId || draggedThemeId === theme.id || !siblingThemes.some((item) => item.id === draggedThemeId)) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOverThemeId(theme.id);
    };
    const handleThemeDrop = (event: React.DragEvent<HTMLDivElement>) => {
        setDragOverThemeId(null);
        if (!draggedThemeId || draggedThemeId === theme.id || !siblingThemes.some((item) => item.id === draggedThemeId)) {
            return;
        }
        event.preventDefault();
        setDraggedThemeId(null);
        void reorderThemes(courseId, siblingThemes, draggedThemeId, theme.id);
    };
    const handleTaskDragStart = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
        setDraggedTaskId(taskId);
        event.dataTransfer.setData("application/x-task-id", taskId);
        event.dataTransfer.effectAllowed = "move";
    };
    const handleTaskDragOver = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
        if (!draggedTaskId || draggedTaskId === taskId) {
            return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOverTaskId(taskId);
    };
    const handleTaskDrop = (event: React.DragEvent<HTMLDivElement>, taskId: string) => {
        setDragOverTaskId(null);
        if (!draggedTaskId || draggedTaskId === taskId) {
            return;
        }
        event.preventDefault();
        setDraggedTaskId(null);
        void reorderTasks(theme.id, orderedTasks, draggedTaskId, taskId);
    };

    // Get task count from props instead of loading tasks
    const taskCount = themeTaskCounts[theme.id] || 0;

    // Only load tasks for display when expanded (not for counting)
    useEffect(() => {
        if (isExpanded && !hasChildren) {
            console.warn("TASK_DEBUG loading list", {
                themeId: theme.id,
                themeName: theme.name,
            });
            axiosInstance.get(`/task/theme/${theme.id}`)
                .then((res: any) => {
                    const items = Array.isArray(res.data) ? (res.data as TaskModel[]) : [];
                    console.warn("TASK_DEBUG backend list", {
                        themeId: theme.id,
                        data: res.data,
                    });
                    console.warn("TASK_DEBUG loaded list", {
                        themeId: theme.id,
                        tasks: items.map((item) => ({
                            id: item.id,
                            question: item.question,
                            position: item.position,
                        })),
                    });
                    setTasks(
                        [...items].sort(compareTaskModels),
                    );
                })
                .catch((err: unknown) => {
                    console.error(`Failed to load tasks for theme ${theme.id}:`, err);
                    setTasks([]);
                });
        }
        if (!isExpanded) {
            setTasks([]);
        }
    }, [isExpanded, hasChildren, theme.id, taskRefreshTrigger]); // Add taskRefreshTrigger as dependency

    // Button logic based on your requirements:
    // - Theme with sub-themes: only "Create Sub-theme" button
    // - Theme with tasks (no sub-themes): only "Create Task" button  
    // - Theme with no sub-themes and no tasks: both buttons
    let showCreateTheme = true;
    let showCreateTask = true;
    
    if (hasChildren) {
        // Theme has sub-themes -> only show create sub-theme button
        showCreateTask = false;
    } else if (taskCount > 0) {
        // Theme has tasks -> only show create task button
        showCreateTheme = false;
    }
    // If no children and no tasks -> show both buttons (default)

    if (false) {
    console.log(`🔍 Theme "${theme.name}" (${theme.id}):`, {
        taskCount,
        hasChildren,
        showCreateTheme,
        showCreateTask,
        themeTaskCountsHasThisId: theme.id in themeTaskCounts
    });
    }

    return (
        <div style={{ marginBottom: "8px", marginLeft: theme.parentThemeId ? 20 : 0 }}>
            <div
                onClick={() => onThemeClick(theme.id)}
                draggable
                onDragStart={handleThemeDragStart}
                onDragEnd={() => {
                    setDragOverThemeId(null);
                    setDraggedThemeId(null);
                }}
                onDragOver={handleThemeDragOver}
                onDragLeave={() => setDragOverThemeId((current) => (current === theme.id ? null : current))}
                onDrop={handleThemeDrop}
                style={{
                    padding: "10px 14px",
                    background: dragOverThemeId === theme.id ? "rgba(255, 99, 71, 0.08)" : "var(--color-card)",
                    border: dragOverThemeId === theme.id ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                    borderRadius: "4px",
                    cursor: movingThemeId === theme.id ? "grabbing" : "grab",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                    <span
                        title="Перетащить тему"
                        style={{
                            color: "var(--color-text-secondary)",
                            fontSize: "1rem",
                            cursor: movingThemeId === theme.id ? "grabbing" : "grab",
                            userSelect: "none",
                            flexShrink: 0,
                        }}
                    >
                        ::
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <strong>{theme.name}</strong>
                        {theme.description && (
                            <p style={{ margin: "2px 0 0 0", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>{theme.description}</p>
                        )}
                        <div style={{ marginTop: "2px", fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>
                            {hasChildren
                                ? `Подтем: ${node.children.length}`
                                : taskCount > 0
                                    ? `Задач: ${taskCount}`
                                    : "Задач: 0"}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            openModal("theme", theme.parentThemeId ?? null, theme, theme.courseId);
                        }}
                        style={{ padding: "4px 8px", background: "var(--color-border)", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                    >✏️</button>
                    {showCreateTheme && (
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                openModal("theme", theme.id, undefined, theme.courseId);
                            }}
                            style={{ padding: "4px 8px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >+ Добавить под-тему</button>
                    )}
                    {showCreateTask && (
                        <button
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                e.stopPropagation();
                                openTaskEditor(theme.id, theme.name);
                            }}
                            style={{ padding: "4px 8px", background: "var(--color-primary)", color: "white", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                        >+ Создать задачу</button>
                    )}
                    <button
                        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                            e.stopPropagation();
                            handleDeleteTheme(theme);
                        }}
                        title="Удалить тему"
                        style={{ padding: "4px 8px", background: "#f44336", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "0.8rem" }}
                    >🗑️</button>
                    <span>{isExpanded ? "▼" : "▶"}</span>
                </div>
            </div>
            {/* Render children recursively if expanded */}
            {isExpanded && hasChildren && (
                <div style={{ marginLeft: 20 }}>
                    {orderedChildren.map((child: ThemeTreeNode) => (
                        <ThemeTreeNodeComponent
                            key={child.theme.id}
                            node={child}
                            courseId={courseId}
                            siblingThemes={orderedChildren.map((item) => item.theme)}
                            expandedThemes={expandedThemes}
                            onThemeClick={onThemeClick}
                            openModal={openModal}
                            openTaskEditor={openTaskEditor}
                            taskModels={taskModels}
                            taskOverrides={taskOverrides}
                            deleteTaskModel={deleteTaskModel}
                            themeTaskCounts={themeTaskCounts}
                            handleDeleteTask={handleDeleteTask}
                            taskRefreshTrigger={taskRefreshTrigger}
                            handleDeleteTheme={handleDeleteTheme}
                            moveTheme={moveTheme}
                            moveTask={moveTask}
                            reorderThemes={reorderThemes}
                            reorderTasks={reorderTasks}
                            draggedThemeId={draggedThemeId}
                            setDraggedThemeId={setDraggedThemeId}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            movingThemeId={movingThemeId}
                            movingTaskId={movingTaskId}
                        />
                    ))}
                </div>
            )}
            {/* Show tasks if expanded and no children */}
            {isExpanded && !hasChildren && orderedTasks.length > 0 && (
                <div style={{ marginTop: "8px", paddingLeft: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <h6 style={{ margin: 0, fontWeight: 600 }}>Задачи (новый редактор)</h6>
                    </div>
                    {orderedTasks.map((task: TaskModel) => (
                        <div
                            key={task.id}
                            draggable
                            onDragStart={(event) => handleTaskDragStart(event, task.id)}
                            onDragEnd={() => {
                                setDragOverTaskId(null);
                                setDraggedTaskId(null);
                            }}
                            onDragOver={(event) => handleTaskDragOver(event, task.id)}
                            onDragLeave={() => setDragOverTaskId((current) => (current === task.id ? null : current))}
                            onDrop={(event) => handleTaskDrop(event, task.id)}
                            style={{
                                padding: "8px 12px",
                                background: dragOverTaskId === task.id ? "rgba(255, 99, 71, 0.08)" : "var(--color-bg)",
                                border: dragOverTaskId === task.id ? "1px solid var(--color-primary)" : "1px solid var(--color-border)",
                                borderRadius: "4px",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: "12px",
                                overflow: "hidden",
                                cursor: movingTaskId === task.id ? "grabbing" : "grab",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, maxWidth: "100%", overflow: "hidden" }}>
                                <span
                                    title="Перетащить задачу"
                                    style={{
                                        color: "var(--color-text-secondary)",
                                        fontSize: "1rem",
                                        cursor: movingTaskId === task.id ? "grabbing" : "grab",
                                        userSelect: "none",
                                        flexShrink: 0,
                                    }}
                                >
                                    ::
                                </span>
                                <div style={{ minWidth: 0, flex: 1, maxWidth: "100%", overflow: "hidden" }}>
                                    <span
                                        style={{
                                            display: "block",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                        }}
                                        title={task.question || "Без вопроса"}
                                    >{task.question || "Без вопроса"}</span>
                                    <div style={{ fontSize: "0.8rem", color: "var(--color-text-secondary)" }}>{taskTypesToRu(task.taskType as any)}</div>
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                <button
                                    onClick={() => openTaskEditor(theme.id, theme.name, task)}
                                    style={{ padding: "2px 6px", background: "var(--color-border)", border: "none", borderRadius: "2px", cursor: "pointer", fontSize: "0.7rem" }}
                                >✏️</button>
                                <button
                                    onClick={() => handleDeleteTask(task.id, theme.id)}
                                    title="Удалить задачу"
                                    style={{ padding: "2px 6px", background: "#f44336", color: "#fff", border: "none", borderRadius: "2px", cursor: "pointer", fontSize: "0.7rem" }}
                                >🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const CoursesManagement = () => {
    const [courseTaskCounts, setCourseTaskCounts] = useState<{[courseId: string]: number}>({});
    const [themeTaskCounts, setThemeTaskCounts] = useState<{[themeId: string]: number}>({});
    const [taskOverrides, setTaskOverrides] = useState<Record<string, TaskModel[]>>({});
    const [themePositionOverrides, setThemePositionOverrides] = useState<Record<string, number>>({});
    const [taskRefreshTrigger, setTaskRefreshTrigger] = useState(0); // Add trigger for task list refresh
    const [draggedThemeId, setDraggedThemeId] = useState<string | null>(null);
    const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
    const [movingThemeId, setMovingThemeId] = useState<string | null>(null);
    const [movingTaskId, setMovingTaskId] = useState<string | null>(null);

    const {
        courses,
        themeTree,
        isLoadingCourses,
        taskModels,
        deleteTaskModel,
        // add other needed context values
    createCourse,
    updateCourse,
    deleteCourse,
    createTheme,
    updateTheme,
    deleteTheme,
    loadCourses,
    loadThemeTree
    } = useContent();

    const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
    const [expandedThemes, setExpandedThemes] = useState<string[]>([]);
    const [modalState, setModalState] = useState<{ isOpen: boolean; type: string | null; editItem: any; parentId?: string | null, courseId?: string | null }>({ isOpen: false, type: null, editItem: null, parentId: null, courseId: null });
    const [taskEditorState, setTaskEditorState] = useState<{ isOpen: boolean; themeId: string | null; themeName: string | null; task: any }>({ isOpen: false, themeId: null, themeName: null, task: null });

    // New state: Import / Export / Clone modals
    const [importModal, setImportModal] = useState<{ isOpen: boolean; targetCourseId?: string; createIfMissing: boolean; addOnly: boolean; file: File | null; error?: string }>(
        { isOpen: false, targetCourseId: undefined, createIfMissing: true, addOnly: false, file: null, error: undefined }
    );
    const [exportModal, setExportModal] = useState<{ isOpen: boolean; courseId?: string; since: string; error?: string }>(
        { isOpen: false, courseId: undefined, since: "", error: undefined }
    );
    const [cloneModal, setCloneModal] = useState<{ isOpen: boolean; sourceCourseId?: string; name: string; language: string; error?: string }>(
        { isOpen: false, sourceCourseId: undefined, name: "", language: "", error: undefined }
    );

    // Load courses on mount
    useEffect(() => {
        loadCourses();
    }, []);

    // Load theme trees for all courses after courses are loaded
    useEffect(() => {
        const loadAllThemeTreesAndCounts = async () => {
            if (courses.length > 0) {
                // Load theme trees for all courses
                for (const course of courses as any[]) {
                    try {
                        await loadThemeTree(course.id, "course");
                    } catch (error) {
                        console.error(`Error loading theme tree for course ${course.id}:`, error);
                    }
                }
            }
        };

        loadAllThemeTreesAndCounts();
    }, [courses]);

    // Load task counts after courses are loaded
    useEffect(() => {
        (async () => {
            if (courses.length > 0) {
                const counts: {[courseId: string]: number} = {};
                await Promise.all(courses.map(async (course: any) => {
                    try {
                        const resp: any = await axiosInstance.get(`/content/stats/course/${course.id}/tasks-count`);
                        // Sum all values in the returned map
                        const total = Object.values(resp.data as Record<string, number>).reduce((acc: number, val) => acc + (typeof val === "number" ? val : 0), 0);
                        counts[course.id] = total;
                    } catch {
                        counts[course.id] = 0;
                    }
                }));
                setCourseTaskCounts(counts);
            }
        })();
    }, [courses]);

    // Load theme tree when a course is expanded
    useEffect(() => {
        if (expandedCourse) {
            loadThemeTree(expandedCourse, "course");
        }
    }, [expandedCourse]); // Remove loadThemeTree from dependencies to prevent infinite loop

    // Modal handlers
    // Refactored openModal to always set courseId and parentId correctly for theme creation/edit
    const openModal = (type: string, parentId?: string | null, editItem?: any, courseId?: string) => {
        setModalState({ isOpen: true, type, editItem, parentId: parentId ?? null, courseId: courseId ?? null });
    };
    const closeModal = () => {
        setModalState({ isOpen: false, type: null, editItem: null, parentId: null, courseId: null });
    };
    const handleModalSave = async (data: { 
        name: string; 
        description?: string; 
        position?: number;
        authorUrl?: string;
        language?: string;
        posterId?: string | null;
        isPublished?: boolean;
    }) => {
        try {
        if (modalState.type === "course") {
            // Use correct argument signature for updateCourse and createCourse
            if (modalState.editItem) {
                await updateCourse(
                    modalState.editItem.id,
                    data.name,
                    data.description,
                    data.authorUrl,
                    data.language,
                    data.isPublished,
                    data.posterId
                );
            } else {
                await createCourse(
                    data.name,
                    data.description,
                    data.authorUrl,
                    data.language,
                    data.isPublished,
                    data.posterId
                );
            }
            await loadCourses();
            // Reload course task counts after course operations
            const counts: {[courseId: string]: number} = {};
            await Promise.all(courses.map(async (course: any) => {
                try {
                    const resp: any = await axiosInstance.get(`/content/stats/course/${course.id}/tasks-count`);
                    const total = Object.values(resp.data as Record<string, number>).reduce((acc: number, val) => acc + (typeof val === "number" ? val : 0), 0);
                    counts[course.id] = total;
                } catch {
                    counts[course.id] = 0;
                }
            }));
            setCourseTaskCounts(counts);
        } else if (modalState.type === "theme") {
            if (modalState.editItem) {
                await updateTheme(
                    modalState.editItem.id,
                    data.name,
                    data.description
                );
                // Refresh task count for updated theme
                await refreshThemeTaskCount(modalState.editItem.id);
                // Reload theme tree for the course to show changes
                if (modalState.courseId || modalState.editItem.courseId) {
                    await loadThemeTree(modalState.courseId || modalState.editItem.courseId, "course");
                }
            } else {
                // Strict theme creation logic:
                // Top-level theme: parentThemeId = null, courseId set
                // Sub-theme: parentThemeId set, courseId set
                const newTheme = await createTheme({
                    courseId: modalState.courseId || "",
                    parentThemeId: modalState.parentId ?? null,
                    name: data.name,
                    description: data.description,
                    position: data.position ?? null
                });
                // Refresh task count for new theme (will be 0 initially)
                if (newTheme?.id) {
                    await refreshThemeTaskCount(newTheme.id);
                }
                // Reload theme tree for the course to show the new theme
                if (modalState.courseId) {
                    await loadThemeTree(modalState.courseId, "course");
                }
            }
        }
        closeModal();
        } catch (error) {
            console.error("Save modal failed:", error);
            window.alert(getApiErrorMessage(error, "Не удалось сохранить изменения."));
            throw error;
        }
    };
    const handleDelete = async (type: string, item: any) => {
        try {
        if (type === "course") {
            await deleteCourse(item.id);
            await loadCourses();
            // Reload course task counts after deletion
            const counts: {[courseId: string]: number} = {};
            await Promise.all(courses.map(async (course: any) => {
                try {
                    const resp: any = await axiosInstance.get(`/content/stats/course/${course.id}/tasks-count`);
                    const total = Object.values(resp.data as Record<string, number>).reduce((acc: number, val) => acc + (typeof val === "number" ? val : 0), 0);
                    counts[course.id] = total;
                } catch {
                    counts[course.id] = 0;
                }
            }));
            setCourseTaskCounts(counts);
        } else if (type === "theme") {
            await deleteTheme(item.id);
            // Reload theme tree for the course after theme deletion
            if (item.courseId) {
                await loadThemeTree(item.courseId, "course");
            }
            // Remove from task counts
            setThemeTaskCounts((prev: Record<string, number>) => {
                const newCounts = { ...prev };
                delete newCounts[item.id];
                return newCounts;
            });
        }
        closeModal();
        } catch (error) {
            console.error("Delete modal failed:", error);
            window.alert(getApiErrorMessage(error, "Не удалось удалить объект."));
            throw error;
        }
    };
    
    const handleCourseClick = (id: string) => setExpandedCourse(expandedCourse === id ? null : id);
    const handleThemeClick = (id: string) => {
        setExpandedThemes((prev: string[]) =>
            prev.includes(id)
                ? prev.filter((tid: string) => tid !== id)
                : [...prev, id]
        );
    };
    const getModalTitleText = () => {
        if (modalState.type === "course") return modalState.editItem ? "Редактировать курс" : "Создать курс";
        if (modalState.type === "theme") return modalState.editItem ? "Редактировать тему" : "Создать тему";
        return "";
    };
    const getDeleteWarningText = (type: string, item: any) => {
        if (type === "course") return `Удалить курс "${item.name}"? Все темы и задачи будут удалены.`;
        if (type === "theme") return `Удалить тему "${item.name}"? Все задачи будут удалены.`;
        return "";
    };
    const openTaskEditor = (themeId: string, themeName: string, task?: any) => setTaskEditorState({ isOpen: true, themeId, themeName, task });
    const closeTaskEditor = () => setTaskEditorState({ isOpen: false, themeId: null, themeName: null, task: null });
    const refreshThemeTasks = async (themeId: string) => {
        setTaskOverrides((prev) => {
            const next = { ...prev };
            delete next[themeId];
            return next;
        });
        await refreshThemeTaskCount(themeId);
        setTaskRefreshTrigger((prev: number) => prev + 1);
    };

    // Fetch task counts for all themes whenever theme tree changes
    useEffect(() => {
        const fetchTaskCounts = async () => {
            const allThemeIds: string[] = [];
            
            // Helper function to recursively collect all theme IDs
            const collectThemeIds = (nodes: any[]): string[] => {
                const ids: string[] = [];
                for (const node of nodes) {
                    ids.push(node.theme.id);
                    if (node.children && node.children.length > 0) {
                        ids.push(...collectThemeIds(node.children));
                    }
                }
                return ids;
            };

            // Collect all theme IDs from all theme trees
            Object.values(themeTree).forEach((treeNodes: any) => {
                if (treeNodes && Array.isArray(treeNodes)) {
                    allThemeIds.push(...collectThemeIds(treeNodes));
                }
            });

            if (allThemeIds.length > 0) {
                const counts: {[themeId: string]: number} = {};
                
                // Fetch task count for each theme using the correct endpoint
                for (const themeId of allThemeIds) {
                    try {
                        const response: any = await axiosInstance.get(`/content/stats/theme/${themeId}/tasks-count`);
                        // The response is a Map_String, so we need to sum the values
                        const taskCountMap = response.data as Record<string, number>;
                        const totalTasks = Object.values(taskCountMap).reduce((sum: number, count: number) => sum + (typeof count === 'number' ? count : 0), 0);
                        counts[themeId] = totalTasks;
                    } catch (error) {
                        counts[themeId] = 0;
                        console.error(`Error getting task count for theme ${themeId}:`, error);
                    }
                }
                
                setThemeTaskCounts(counts);
            }
        };

        // Only fetch if we have theme trees
        if (Object.keys(themeTree).length > 0) {
            fetchTaskCounts();
        }
    }, [themeTree]); // Removed getTasksCountByTheme to prevent infinite loops

    // Function to refresh task count for a specific theme
    const refreshThemeTaskCount = async (themeId: string) => {
        try {
            const response: any = await axiosInstance.get(`/content/stats/theme/${themeId}/tasks-count`);
            // The response is a Map_String, so we need to sum the values
            const taskCountMap = response.data as Record<string, number>;
            const totalTasks = Object.values(taskCountMap).reduce((sum: number, count: number) => sum + (typeof count === 'number' ? count : 0), 0);
            setThemeTaskCounts((prev: Record<string, number>) => ({ ...prev, [themeId]: totalTasks }));
        } catch (error) {
            setThemeTaskCounts((prev: Record<string, number>) => ({ ...prev, [themeId]: 0 }));
            console.error(`Error refreshing task count for theme ${themeId}:`, error);
        }
    };

    // Wrapper for deleteTaskModel that also refreshes task count
    const handleDeleteTask = async (taskId: string, themeId: string) => {
        if (deleteTaskModel) {
            await deleteTaskModel(taskId, themeId);
            await refreshThemeTaskCount(themeId);
            
            // Trigger refresh of task lists by incrementing the refresh trigger
            setTaskRefreshTrigger((prev: number) => prev + 1);
        }
    };

    const persistThemeOrder = async (courseId: string, reordered: any[], movedThemeId: string) => {
        setMovingThemeId(movedThemeId);
        try {
            console.warn("THEME_DEBUG sending reorder", {
                courseId,
                movedThemeId,
                payloads: reordered.map((item, index) => ({
                    id: item.id,
                    name: item.name,
                    position: index,
                })),
            });
            await Promise.all(
                reordered.map((item, index) =>
                    updateThemePositionApi(item, index).then((response) => {
                        console.warn("THEME_DEBUG reorder response", {
                            id: item.id,
                            status: response.status,
                            data: response.data,
                        });
                        return response;
                    }),
                ),
            );
            await loadThemeTree(courseId, "course");
        } catch (error) {
            console.error("Failed to reorder themes:", error);
            await loadThemeTree(courseId, "course");
            window.alert(getApiErrorMessage(error, "Не удалось изменить порядок тем."));
        } finally {
            setMovingThemeId(null);
        }
    };

    const persistTaskOrder = async (themeId: string, originalTasks: TaskModel[], reorderedWithPositions: TaskModel[], movedTaskId: string) => {
        setMovingTaskId(movedTaskId);
        try {
            console.warn("TASK_DEBUG sending reorder", {
                themeId,
                movedTaskId,
                payloads: reorderedWithPositions.map((item, index) => ({
                    id: item.id,
                    position: index,
                    taskTypes: getTaskTypeArray(item),
                })),
            });
            setTaskOverrides((prev) => ({
                ...prev,
                [themeId]: reorderedWithPositions,
            }));
            const originalById = new Map(originalTasks.map((item) => [item.id, item]));
            const movedOriginal = originalById.get(movedTaskId);
            const movedUpdated = reorderedWithPositions.find((item) => item.id === movedTaskId);

            if (!movedOriginal || !movedUpdated) {
                throw new Error("Moved task snapshot is missing");
            }

            const movedFrom = movedOriginal.position ?? 0;
            const movedTo = movedUpdated.position ?? 0;
            const tempPosition = Math.max(
                ...originalTasks.map((item) => item.position ?? 0),
                ...reorderedWithPositions.map((item) => item.position ?? 0),
            ) + 1;

            const changedOthers = reorderedWithPositions.filter(
                (item) => item.id !== movedTaskId && (originalById.get(item.id)?.position ?? 0) !== (item.position ?? 0),
            );
            const orderedOthers =
                movedFrom < movedTo
                    ? [...changedOthers].sort((a, b) => (originalById.get(a.id)?.position ?? 0) - (originalById.get(b.id)?.position ?? 0))
                    : [...changedOthers].sort((a, b) => (originalById.get(b.id)?.position ?? 0) - (originalById.get(a.id)?.position ?? 0));

            const runUpdate = async (item: TaskModel, position: number) => {
                const response = await updateTaskPositionApi(item, themeId, position);
                console.warn("TASK_DEBUG reorder response", {
                    id: item.id,
                    status: response.status,
                    data: response.data,
                    position,
                });
                return response;
            };

            await runUpdate(movedUpdated, tempPosition);
            for (const item of orderedOthers) {
                await runUpdate(item, item.position ?? 0);
            }
            await runUpdate(movedUpdated, movedTo);
            await refreshThemeTasks(themeId);
        } catch (error) {
            console.error("Failed to reorder tasks:", error);
            await refreshThemeTasks(themeId);
            window.alert(getApiErrorMessage(error, "Не удалось изменить порядок задач."));
        } finally {
            setMovingTaskId(null);
        }
    };

    const moveTheme = async (theme: any, siblingThemes: any[], courseId: string, direction: -1 | 1) => {
        const currentIndex = siblingThemes.findIndex((item) => item.id === theme.id);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= siblingThemes.length) {
            return;
        }

        const reordered = [...siblingThemes];
        const [movedTheme] = reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, movedTheme);
        await persistThemeOrder(courseId, reordered, theme.id);
        return;
        setMovingThemeId(theme.id);
        try {
            setThemePositionOverrides((prev) => ({
                ...prev,
                ...Object.fromEntries(reordered.map((item, index) => [item.id, index])),
            }));
            console.warn("THEME_DEBUG sending reorder", {
                courseId,
                movedThemeId: theme.id,
                payloads: reordered.map((item, index) => ({
                    id: item.id,
                    name: item.name,
                    position: index,
                })),
            });
            await Promise.all(
                reordered.map((item, index) =>
                    updateThemePositionApi(item, index).then((response) => {
                        console.warn("THEME_DEBUG reorder response", {
                            id: item.id,
                            status: response.status,
                            data: response.data,
                        });
                        return response;
                    }),
                ),
            );
            await loadThemeTree(courseId, "course");
        } catch (error) {
            console.error("Failed to reorder themes:", error);
            window.alert(getApiErrorMessage(error, "Не удалось изменить порядок тем."));
        } finally {
            setMovingThemeId(null);
        }
    };

    const moveTask = async (themeId: string, tasks: TaskModel[], task: TaskModel, direction: -1 | 1) => {
        const currentIndex = tasks.findIndex((item) => item.id === task.id);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= tasks.length) {
            return;
        }

        const reordered = [...tasks];
        const [movedTask] = reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, movedTask);

        setMovingTaskId(task.id);
        const reorderedForMove = reordered.map((item, index) => ({
            ...item,
            position: index,
        }));
        await persistTaskOrder(themeId, tasks, reorderedForMove, task.id);
        return;
        try {
            const reorderedWithPositions = reordered.map((item, index) => ({
                ...item,
                position: index,
            }));
            console.warn("TASK_DEBUG sending reorder", {
                themeId,
                movedTaskId: task.id,
                payloads: reorderedWithPositions.map((item, index) => ({
                    id: item.id,
                    position: index,
                    taskTypes: getTaskTypeArray(item),
                })),
            });
            setTaskOverrides((prev) => ({
                ...prev,
                [themeId]: reorderedWithPositions,
            }));
            await Promise.all(
                reorderedWithPositions.map((item, index) =>
                    updateTaskPositionApi(item, themeId, index).then((response) => {
                        console.warn("TASK_DEBUG reorder response", {
                            id: item.id,
                            status: response.status,
                            data: response.data,
                        });
                        return response;
                    }),
                ),
            );
            await refreshThemeTasks(themeId);
        } catch (error) {
            console.error("Failed to reorder tasks:", error);
            await refreshThemeTasks(themeId);
            window.alert(getApiErrorMessage(error, "Не удалось изменить порядок задач."));
        } finally {
            setMovingTaskId(null);
        }
    };

    const reorderThemes = async (courseId: string, siblingThemes: any[], draggedThemeId: string, targetThemeId: string) => {
        const currentIndex = siblingThemes.findIndex((item) => item.id === draggedThemeId);
        const targetIndex = siblingThemes.findIndex((item) => item.id === targetThemeId);
        if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
            return;
        }

        const reordered = [...siblingThemes];
        const [movedTheme] = reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, movedTheme);
        await persistThemeOrder(courseId, reordered, draggedThemeId);
    };

    const reorderTasks = async (themeId: string, tasks: TaskModel[], draggedTaskId: string, targetTaskId: string) => {
        const currentIndex = tasks.findIndex((item) => item.id === draggedTaskId);
        const targetIndex = tasks.findIndex((item) => item.id === targetTaskId);
        if (currentIndex < 0 || targetIndex < 0 || currentIndex === targetIndex) {
            return;
        }

        const reordered = [...tasks];
        const [movedTask] = reordered.splice(currentIndex, 1);
        reordered.splice(targetIndex, 0, movedTask);
        const reorderedWithPositions = reordered.map((item, index) => ({
            ...item,
            position: index,
        }));
        await persistTaskOrder(themeId, tasks, reorderedWithPositions, draggedTaskId);
    };

    // Handle theme deletion
    const handleDeleteTheme = async (theme: any) => {
        await handleDelete("theme", theme);
    };

    // Helper function to count all themes recursively in a course
    const getTotalThemeCount = (courseId: string): number => {
        if (!themeTree[courseId]) return 0;
        
        const countThemes = (nodes: ThemeTreeNode[]): number => {
            let count = 0;
            for (const node of nodes) {
                count += 1; // Count this theme
                if (node.children && node.children.length > 0) {
                    count += countThemes(node.children); // Count children recursively
                }
            }
            return count;
        };
        
        return countThemes(themeTree[courseId] as any);
    };

    // ===== Import / Export / Clone handlers =====
    const openImport = (targetCourseId?: string) => {
        setImportModal({
            isOpen: true,
            targetCourseId,
            createIfMissing: !targetCourseId,
            addOnly: false,
            file: null,
            error: undefined,
        });
    };

    const submitImport = async () => {
        try {
            if (!importModal.file) {
                setImportModal((prev) => ({ ...prev, error: 'Выберите .json файл' }));
                return;
            }
            const file = importModal.file;
            const isJson = file.name.toLowerCase().endsWith('.json') || file.type === 'application/json';
            if (!isJson) {
                setImportModal((prev) => ({ ...prev, error: 'Разрешены только .json файлы' }));
                return;
            }
            const text = await file.text();
            let payload: any;
            try {
                payload = JSON.parse(text);
            } catch (e) {
                setImportModal((prev) => ({ ...prev, error: 'Некорректный JSON' }));
                return;
            }

            // Обязателен язык курса в JSON
            const lang = payload?.course?.language;
            if (!lang || typeof lang !== 'string' || !lang.trim()) {
                setImportModal((prev) => ({ ...prev, error: 'В JSON отсутствует course.language (обязательное поле)' }));
                return;
            }

            await contentService.importCourse(payload, {
                targetCourseId: importModal.targetCourseId || undefined,
                createIfMissing: importModal.createIfMissing,
                addOnly: importModal.addOnly,
            });

            // Refresh data
            await loadCourses();
            if (importModal.targetCourseId) {
                await loadThemeTree(importModal.targetCourseId, 'course');
            }

            setImportModal((prev) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
            setImportModal((prev) => ({ ...prev, error: e?.message || 'Ошибка импорта' }));
        }
    };

    const openExport = (courseId: string) => {
        const now = new Date();
        const tzAdj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        const localStr = tzAdj.toISOString().slice(0, 16);
        setExportModal({ isOpen: true, courseId, since: localStr, error: undefined });
    };
    const submitExport = async () => {
        console.log("Exporting course:", exportModal.courseId, "Since:", exportModal.since);
        if (!exportModal.courseId) return;
        try {
            // Validate and convert since
            let sinceIso: string | undefined = undefined;
            if (exportModal.since) {
                const d = new Date(exportModal.since);
                if (isNaN(d.getTime())) {
                    setExportModal((prev: any) => ({ ...prev, error: 'Некорректная дата/время. Используйте контрол выбора даты-времени.' }));
                    return;
                }
                sinceIso = d.toISOString();
                console.log("ISO Date:", sinceIso);
            } else {
                console.log("No date selected, exporting full course");
            }
            const data = await contentService.exportCourse(exportModal.courseId, sinceIso);
            const course = courses.find((c: any) => c.id === exportModal.courseId);
            const safeName = (course?.name || exportModal.courseId).replace(/[^a-zA-Z0-9-_]+/g, '_');
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const jsonString = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${safeName}-${stamp}.json`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
            setExportModal((prev: any) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
            alert(e?.message || 'Ошибка экспорта');
        }
    };

    const openClone = (sourceCourseId: string) => {
        setCloneModal({ isOpen: true, sourceCourseId, name: '', language: 'RUSSIAN', error: undefined });
    };
    const submitClone = async () => {
        if (!cloneModal.sourceCourseId) return;
        if (!cloneModal.name) {
            setCloneModal((prev) => ({ ...prev, error: 'Укажите название нового курса' }));
            return;
        }
        if (!cloneModal.language) {
            setCloneModal((prev) => ({ ...prev, error: 'Укажите язык' }));
            return;
        }
        try {
            const created = await contentService.cloneCourseStructure(cloneModal.sourceCourseId, { newCourseName: cloneModal.name, newLanguage: cloneModal.language });
            setCloneModal((prev) => ({ ...prev, isOpen: false }));
            await loadCourses();
            if (created?.id) {
                setExpandedCourse(created.id);
            }
        } catch (e: any) {
            setCloneModal((prev) => ({ ...prev, error: e?.message || 'Ошибка клонирования' }));
        }
    };

    // Simple inline modal component
    const Modal = ({ isOpen, title, onClose, children, footer }: { isOpen: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) => {
        if (!isOpen) return null;
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div style={{ background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 8, width: 'min(640px, 92vw)', padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h3 style={{ margin: 0 }}>{title}</h3>
                        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 18 }}>✖</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {children}
                    </div>
                    {footer && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
                            {footer}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
            <div>
                <div
                    style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 5,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "24px",
                        padding: "12px 0",
                        background: "color-mix(in srgb, var(--color-bg) 94%, transparent)",
                        backdropFilter: "blur(6px)",
                        borderBottom: "1px solid color-mix(in srgb, var(--color-border) 70%, transparent)",
                    }}
                >
                    <h2 style={{margin: 0, fontWeight: 700, fontSize: "1.5rem"}}>
                        Управление курсами
                    </h2>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => openImport()}
                            style={{
                                padding: "10px 16px",
                                background: "var(--color-border)",
                                color: "var(--color-text)",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            ⬆️ Импорт
                        </button>
                        <button
                            onClick={() => openModal("course")}
                            style={{
                                padding: "10px 20px",
                                background: "var(--color-primary)",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontWeight: 500,
                            }}
                        >
                            + Создать курс
                        </button>
                    </div>
                </div>

                <div style={{display: "flex", flexDirection: "column", gap: "16px"}}>
                    {isLoadingCourses ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <span className="ml-3 text-gray-600">Загрузка курсов...</span>
                        </div>
                    ) : courses.length === 0 ? (
                        <div
                            style={{
                                border: "1px solid var(--color-border)",
                                borderRadius: "8px",
                                background: "var(--color-card)",
                                padding: "16px 20px",
                                color: "var(--color-text-secondary)",
                            }}
                        >
                            Курсы не найдены
                        </div>
                    ) : (
                        <>
                            {courses.map((course: any) => (
                                <div
                                    key={course.id}
                                    style={{
                                        border: "1px solid var(--color-border)",
                                        borderRadius: "8px",
                                        background: "var(--color-card)",
                                        overflow: "hidden",
                                    }}
                                >
                                    {/* Course Header */}
                                    <div
                                        onClick={() => handleCourseClick(course.id)}
                                        style={{
                                            padding: "16px 20px",
                                            cursor: "pointer",
                                            borderBottom:
                                                expandedCourse === course.id
                                                    ? "1px solid var(--color-border)"
                                                    : "none",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            background:
                                                expandedCourse === course.id
                                                    ? "var(--color-bg)"
                                                    : "transparent",
                                        }}
                                    >
                                        <div style={{flex: 1}}>
                                            <h3 style={{margin: "0 0 4px 0", fontWeight: 600}}>
                                                {course.name}
                                            </h3>
                                            <p
                                                style={{
                                                    margin: 0,
                                                    color: "var(--color-text-secondary)",
                                                    fontSize: "0.95rem",
                                                }}
                                            >
                                                {course.description}
                                            </p>
                                            <div
                                                style={{
                                                    marginTop: "8px",
                                                    fontSize: "0.9rem",
                                                    color: "var(--color-text-secondary)",
                                                }}
                                            >
                                                Тем: {getTotalThemeCount(course.id)} | Задач: {courseTaskCounts[course.id] ?? 0}
                                            </div>
                                        </div>
                                        <div
                                            style={{display: "flex", alignItems: "center", gap: "8px"}}
                                        >
                                            <button
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                                    e.stopPropagation();
                                                    openExport(course.id);
                                                }}
                                                title="Экспортировать курс"
                                                style={{
                                                    padding: "4px 8px",
                                                    background: "var(--color-border)",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                ⬇️
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                                    e.stopPropagation();
                                                    openImport(course.id);
                                                }}
                                                title="Импортировать в этот курс"
                                                style={{
                                                    padding: "4px 8px",
                                                    background: "var(--color-border)",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                ⬆️
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                                    e.stopPropagation();
                                                    openClone(course.id);
                                                }}
                                                title="Клонировать структуру"
                                                style={{
                                                    padding: "4px 8px",
                                                    background: "var(--color-border)",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                🧬
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                                    e.stopPropagation();
                                                    openModal("course", undefined, course);
                                                }}
                                                style={{
                                                    padding: "4px 8px",
                                                    background: "var(--color-border)",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleDelete("course", course); }}
                                                title="Удалить курс"
                                                style={{
                                                    padding: "4px 8px",
                                                    background: "#f44336",
                                                    color: "#fff",
                                                    border: "none",
                                                    borderRadius: "4px",
                                                    cursor: "pointer",
                                                    fontSize: "0.8rem",
                                                }}
                                            >🗑️</button>
                                            <span style={{fontSize: "1.2rem"}}>
                                                {expandedCourse === course.id ? "▼" : "▶"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Theme Tree (no sections) */}
                                    {expandedCourse === course.id && (
                                        <div style={{padding: "16px 20px 16px 40px"}}>
                                            <div
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    marginBottom: "12px",
                                                    padding: "10px 0",
                                                }}
                                            >
                                                <h4 style={{margin: 0, fontWeight: 600}}>Темы</h4>
                                                <button
                                                    onClick={() => openModal("theme", null, undefined, course.id)}
                                                    style={{
                                                        padding: "6px 12px",
                                                        background: "var(--color-primary)",
                                                        color: "white",
                                                        border: "none",
                                                        borderRadius: "4px",
                                                        cursor: "pointer",
                                                        fontSize: "0.9rem",
                                                    }}
                                                >
                                                    + Добавить тему
                                                </button>
                                            </div>

                                            {/* Recursive theme tree rendering */}
                                            {[...(themeTree[course.id] || [])].map((node: ThemeTreeNode) => (
                                                <ThemeTreeNodeComponent
                                                    key={node.theme.id}
                                                    node={node}
                                                    courseId={course.id}
                                                    siblingThemes={[...(themeTree[course.id] || [])].map((item: ThemeTreeNode) => item.theme)}
                                                    expandedThemes={expandedThemes}
                                                    onThemeClick={handleThemeClick}
                                                    openModal={openModal}
                                                    openTaskEditor={openTaskEditor}
                                                    taskModels={taskModels}
                                                    taskOverrides={taskOverrides}
                                                    deleteTaskModel={deleteTaskModel}
                                                    themeTaskCounts={themeTaskCounts}
                                                    handleDeleteTask={handleDeleteTask}
                                                    taskRefreshTrigger={taskRefreshTrigger}
                                                    handleDeleteTheme={handleDeleteTheme}
                            moveTheme={moveTheme}
                            moveTask={moveTask}
                            reorderThemes={reorderThemes}
                            reorderTasks={reorderTasks}
                            draggedThemeId={draggedThemeId}
                            setDraggedThemeId={setDraggedThemeId}
                            draggedTaskId={draggedTaskId}
                            setDraggedTaskId={setDraggedTaskId}
                            movingThemeId={movingThemeId}
                            movingTaskId={movingTaskId}
                        />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                <CreateEditModal
                    isOpen={modalState.isOpen}
                    onClose={closeModal}
                    onSave={handleModalSave}
                    onDelete={
                        modalState.editItem && modalState.type
                            ? () => handleDelete(modalState.type as string, modalState.editItem)
                            : undefined
                    }
                    title={getModalTitleText()}
                    initialName={modalState.editItem?.name || ""}
                    initialDescription={modalState.editItem?.description || ""}
                    isEdit={!!modalState.editItem}
                    deleteWarning={
                        modalState.editItem && modalState.type
                            ? getDeleteWarningText(modalState.type as string, modalState.editItem)
                            : undefined
                    }
                    type={modalState.type as "course" | "theme" | undefined}
                    initialAuthorUrl={modalState.editItem?.authorUrl || ""}
                    initialLanguage={modalState.editItem?.language || ""}
                    initialCoursePosterId={modalState.editItem?.posterId || null}
                    initialIsPublished={modalState.editItem?.isPublished || false}
                />

                <TaskEditorModal
                    isOpen={taskEditorState.isOpen}
                    onClose={() => {
                        const themeId = taskEditorState.themeId;
                        closeTaskEditor();
                        if (themeId) {
                            // Обновляем список после закрытия
                            refreshThemeTasks(themeId);
                        }
                    }}
                    themeId={taskEditorState.themeId!}
                    initialTask={taskEditorState.task || undefined}
                    onCreated={() => {
                        if (taskEditorState.themeId) {
                            refreshThemeTasks(taskEditorState.themeId);
                        }
                    }}
                    onUpdated={() => {
                        if (taskEditorState.themeId) {
                            refreshThemeTasks(taskEditorState.themeId);
                        }
                    }}
                />

                {/* Import Modal */}
                <Modal
                    isOpen={importModal.isOpen}
                    title="Импорт курса"
                    onClose={() => setImportModal((prev) => ({ ...prev, isOpen: false }))}
                    footer={(
                        <>
                            <button onClick={() => setImportModal((prev) => ({ ...prev, isOpen: false }))} style={{ padding: '8px 12px', background: 'var(--color-border)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отмена</button>
                            <button onClick={submitImport} style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Импортировать</button>
                        </>
                    )}
                >
                    <div>
                        <label style={{ display: 'block', marginBottom: 6 }}>JSON файл</label>
                        <input
                            type="file"
                            accept=".json,application/json"
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                const file = e.target.files?.[0] || null;
                                setImportModal((prev) => ({ ...prev, file, error: undefined }));
                            }}
                        />
                        {importModal.error && <div style={{ color: '#f44336', marginTop: 8 }}>{importModal.error}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 240 }}>
                            <label style={{ display: 'block', marginBottom: 6 }}>Целевой курс</label>
                            <select
                                value={importModal.targetCourseId || ''}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setImportModal((prev) => ({ ...prev, targetCourseId: val || undefined, createIfMissing: val ? prev.createIfMissing : true }));
                                }}
                                style={{ width: '100%', padding: 8, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6 }}
                            >
                                <option value="">Создать новый курс</option>
                                {courses.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={importModal.createIfMissing} onChange={(e) => {
                                const checked = e.target.checked;
                                setImportModal((prev) => ({ ...prev, createIfMissing: checked }));
                            }} />
                            Создавать отсутствующие элементы
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={importModal.addOnly} onChange={(e) => {
                                const checked = e.target.checked;
                                setImportModal((prev) => ({ ...prev, addOnly: checked }));
                            }} />
                            Только добавлять (без удаления)
                        </label>
                    </div>
                </Modal>

                {/* Export Modal */}
                <Modal
                    isOpen={exportModal.isOpen}
                    title="Экспорт курса"
                    onClose={() => setExportModal((prev: any) => ({ ...prev, isOpen: false }))}
                    footer={(
                        <>
                            <button onClick={() => setExportModal((prev: any) => ({ ...prev, isOpen: false }))} style={{ padding: '8px 12px', background: 'var(--color-border)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отмена</button>
                            <button onClick={submitExport} style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Экспортировать</button>
                        </>
                    )}
                >
                    <div style={{ minWidth: 280 }}>
                        <div style={{ marginBottom: 8, color: 'var(--color-text-secondary)' }}>Курс: {courses.find((c: any) => c.id === exportModal.courseId)?.name || exportModal.courseId}</div>
                        <label style={{ display: 'block', marginBottom: 6 }}>Изменения с (UTC, опционально)</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                                type="datetime-local"
                                value={exportModal.since || ""}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    console.log("Date input changed:", val);
                                    setExportModal((prev: any) => ({ ...prev, since: val, error: undefined }));
                                }}
                                onBlur={(e) => {
                                    const val = e.target.value;
                                    console.log("Date input blur:", val);
                                    setExportModal((prev: any) => ({ ...prev, since: val, error: undefined }));
                                }}
                                style={{ flex: 1, padding: 8, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6 }}
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const tzAdj = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                                    const localStr = tzAdj.toISOString().slice(0, 16);
                                    setExportModal((prev: any) => ({ ...prev, since: localStr, error: undefined }));
                                }}
                                title="Установить текущее время"
                                style={{ padding: '6px 10px', background: 'var(--color-border)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Сейчас</button>
                            <button
                                type="button"
                                onClick={() => setExportModal((prev: any) => ({ ...prev, since: '', error: undefined }))}
                                title="Очистить"
                                style={{ padding: '6px 10px', background: 'var(--color-border)', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                            >Сброс</button>
                        </div>
                        {exportModal.since && (
                            <div style={{ marginTop: 6, fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                                Будет отправлено как: {(() => { try { return new Date(exportModal.since).toISOString(); } catch { return '—'; } })()}
                            </div>
                        )}
                        {exportModal.error && <div style={{ color: '#f44336', marginTop: 8 }}>{exportModal.error}</div>}
                    </div>
                </Modal>

                {/* Clone Modal */}
                <Modal
                    isOpen={cloneModal.isOpen}
                    title="Клонировать структуру курса"
                    onClose={() => setCloneModal((prev) => ({ ...prev, isOpen: false }))}
                    footer={(
                        <>
                            <button onClick={() => setCloneModal((prev) => ({ ...prev, isOpen: false }))} style={{ padding: '8px 12px', background: 'var(--color-border)', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Отмена</button>
                            <button onClick={submitClone} style={{ padding: '8px 12px', background: 'var(--color-primary)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Клонировать</button>
                        </>
                    )}
                >
                    <div style={{ minWidth: 280 }}>
                        <div style={{ marginBottom: 8, color: 'var(--color-text-secondary)' }}>Источник: {courses.find((c: any) => c.id === cloneModal.sourceCourseId)?.name || cloneModal.sourceCourseId}</div>
                        <label style={{ display: 'block', marginBottom: 6 }}>Название нового курса</label>
                        <input
                            type="text"
                            value={cloneModal.name}
                            onChange={(e) => {
                                const val = e.target.value;
                                setCloneModal((prev) => ({ ...prev, name: val }));
                            }}
                            style={{ width: '100%', padding: 8, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6 }}
                        />
                        <label style={{ display: 'block', marginTop: 12, marginBottom: 6 }}>Язык</label>
                        <select
                            value={cloneModal.language || "RUSSIAN"}
                            onChange={(e) => {
                                const val = e.target.value;
                                setCloneModal((prev) => ({ ...prev, language: val }));
                            }}
                            style={{ width: '100%', padding: 8, background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: 6 }}
                        >
                            <option value="RUSSIAN">Русский</option>
                            <option value="UZBEK">Узбекский</option>
                            <option value="CHINESE">Китайский</option>
                            <option value="HINDI">Хинди</option>
                            <option value="TAJIK">Таджикский</option>
                            <option value="ENGLISH">Английский</option>
                        </select>
                        {cloneModal.error && <div style={{ color: '#f44336', marginTop: 8 }}>{cloneModal.error}</div>}
                    </div>
                </Modal>
            </div>
    );
};
