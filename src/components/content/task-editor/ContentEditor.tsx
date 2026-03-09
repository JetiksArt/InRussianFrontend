import { useState, useEffect } from "react";
import type {
  TaskContent,
  ContentType,
} from "../../../context/content/ContentProvider.tsx";
import { mediaService } from "../../../services/MediaService.ts";
import styles from "./ContentEditor.module.css";
import {RichTextEditor} from "./RichTextEditor.tsx";

interface ContentEditorProps {
  contents: TaskContent[];
  onContentsChange: (contents: TaskContent[]) => void;
}

export const ContentEditor = ({
  contents,
  onContentsChange,
}: ContentEditorProps) => {
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);

  const getMediaKey = (content: TaskContent) =>
    (content.contentId ?? content.id ?? "") as string;

  const addContent = (type: ContentType) => {
    const newContent: TaskContent = {
      id: `content_${Date.now()}`,
      contentType: type,
      orderNum: contents.length,
      description: "",
      text: type === "TEXT" ? "" : undefined,
      contentId: undefined,
    };

    if (type !== "TEXT") {
      // Создаем новый input элемент вместо использования ref
      const input = document.createElement("input");
      input.type = "file";
      input.style.display = "none";
      input.accept =
        type === "IMAGE" ? "image/*" : type === "AUDIO" ? "audio/*" : "video/*";

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          try {
            setIsUploading(true);
            const url = URL.createObjectURL(file);

            const fileName = file.name;
            const mimeType = file.type;
            const fileSize = file.size;
            const fileType = type;

            const formData = new FormData();
            formData.append("file", file);
            formData.append("fileName", fileName);
            formData.append("mimeType", mimeType);
            formData.append("fileSize", fileSize.toString());
            formData.append("fileType", fileType);

            const contentId = (await mediaService.uploadMediaWithMeta(formData))
              .mediaId;
            // console.log(contentId);
            newContent.contentId = contentId;
            onContentsChange([
              ...contents,
              {
                ...newContent,
                contentId,
                url,
                file,
              },
            ]);
          } catch (error) {
            console.error("Ошибка загрузки медиа:", error);
          } finally {
            setIsUploading(false);
            document.body.removeChild(input);
          }
        }
      };

      document.body.appendChild(input);
      input.click();
    } else {
      onContentsChange([...contents, newContent]);
    }
  };

  const updateContent = (id: string, updates: Partial<TaskContent>) => {
    onContentsChange(
      contents.map((content) =>
        content.id === id ? { ...content, ...updates } : content
      )
    );
  };

  const removeContent = async (id: string) => {
    try {
      const contentToDelete = contents.find((c) => c.id === id);
      console.log(contentToDelete);
      if (!contentToDelete) return;
      if (contentToDelete.contentId) {
        try {
          await mediaService.deleteMedia(contentToDelete.contentId);
          console.log(
            `Медиа ${contentToDelete.contentId} успешно удалено на сервере`
          );
        } catch (error) {
          console.error(
            `Ошибка удаления медиа на сервере: ${contentToDelete.contentId}`,
            error
          );
        }
      }
      const key = getMediaKey(contentToDelete);
      if (key && mediaUrls[key]) {
        URL.revokeObjectURL(mediaUrls[key]);
      }
      const filtered = contents.filter((c) => c.id !== id);
      const reordered = filtered.map((c, index) => ({ ...c, orderNum: index }));
      setMediaUrls((prev) => {
        const newUrls = { ...prev };
        if (key) delete newUrls[key];
        return newUrls;
      });

      onContentsChange(reordered);
    } catch (error) {
      console.error("Ошибка при удалении контента:", error);
    }
  };

  const fetchMedia = async (key: string, mediaId: string) => {
    try {
      const mediaBlob = await mediaService.getMediaById(mediaId);
      if (!mediaBlob || mediaBlob.size === 0) {
        throw new Error("Получен пустой Blob");
      }
      const mediaUrl = URL.createObjectURL(mediaBlob);
      setMediaUrls((prev) => ({
        ...prev,
        [key]: mediaUrl,
      }));
    } catch (error) {
      console.error("Ошибка загрузки медиа:", error);
      setMediaUrls((prev) => ({
        ...prev,
        [key]: "/fallback-image.jpg",
      }));
    }
  };

  useEffect(() => {
    contents.forEach((content) => {
      if (content.contentType !== "TEXT") {
        const key = getMediaKey(content);
        if (!key) return;
        if (content.contentId && !mediaUrls[key]) {
          fetchMedia(key, content.contentId);
        } else if (content.url && !mediaUrls[key]) {
          setMediaUrls((prev) => ({
            ...prev,
            [key]: content.url!,
          }));
        }
      }
    });

    return () => {
      Object.values(mediaUrls).forEach(URL.revokeObjectURL);
    };
  }, [contents]);

  console.log(contents);

  return (
    <div>
      <div className={styles.header}>
        <h3 className={styles.title}>Содержимое задачи</h3>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => addContent("TEXT")}
            disabled={isUploading}
            className={styles.actionButton}
          >
            Текст
          </button>
          <button
            type="button"
            onClick={() => addContent("AUDIO")}
            disabled={isUploading}
            className={styles.actionButton}
          >
            Аудио
          </button>
          <button
            type="button"
            onClick={() => addContent("IMAGE")}
            disabled={isUploading}
            className={styles.actionButton}
          >
            Изображение
          </button>
          <button
            type="button"
            onClick={() => addContent("VIDEO")}
            disabled={isUploading}
            className={styles.actionButton}
          >
            Видео
          </button>
        </div>
      </div>

      {isUploading && (
        <div className={styles.uploading}>Загрузка медиафайла...</div>
      )}

      <div className={styles.list}>
    {contents.map((content) => (
          <div
            key={content.id}
            className={styles.card}
          >
            <button
      onClick={() => removeContent(content.id as string)}
              className={styles.removeButton}
            >
              <span>×</span>
      <span className={styles.removeButtonLabel}>Удалить</span>
            </button>

            {content.contentType === "TEXT" ? (
              <RichTextEditor
                value={content.text || ""}
                onChange={(v) =>
                  updateContent(content.id as string, { text: v })
                }
                placeholder="Введите текст..."
              />
            ) : (
              <div className={styles.mediaBlock}>
                {(mediaUrls[getMediaKey(content)] || content.url) && (
                  <div className={styles.mediaPreview}>
                    {content.contentType === "IMAGE" && (
                      <img
                        src={mediaUrls[getMediaKey(content)] || content.url}
                        alt=""
                        className={styles.image}
                        onError={() => {
                          console.error("Ошибка загрузки изображения");
                        }}
                      />
                    )}

                    {content.contentType === "AUDIO" && (
                      <audio controls className={styles.audio}>
                        <source
                          src={mediaUrls[getMediaKey(content)] || content.url}
                          type="audio/mpeg"
                        />
                      </audio>
                    )}

                    {content.contentType === "VIDEO" && (
                      <video controls className={styles.video}>
                        <source
                          src={mediaUrls[getMediaKey(content)] || content.url}
                          type="video/mp4"
                        />
                      </video>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className={styles.fieldsGrid}>
              <div>
                <label
                  className={styles.label}
                >
                  Описание
                </label>
                <RichTextEditor
                  value={content.description || ""}
                  onChange={(v) =>
                    updateContent(content.id as string, { description: v })
                  }
                  placeholder="Описание контента"
                />
              </div>
              <div>
                <label
                  className={styles.label}
                >
                  Транскрипция
                </label>
                <RichTextEditor
                  value={content.transcription || ""}
                  onChange={(v) =>
                    updateContent(content.id as string, {
                      transcription: v,
                    })
                  }
                  placeholder="Транскрипция"
                />
              </div>
              <div>
                <label
                  className={styles.label}
                >
                  Перевод
                </label>
                <RichTextEditor
                  value={content.translation || ""}
                  onChange={(v) =>
                    updateContent(content.id as string, { translation: v })
                  }
                  placeholder="Перевод"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {contents.length === 0 && (
        <div className={styles.empty}>
          Добавьте содержимое для задачи
        </div>
      )}
    </div>
  );
};



