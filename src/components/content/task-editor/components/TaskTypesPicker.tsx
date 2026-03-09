import React from "react";
import styles from "../ContentEditor.module.css";
import taskTypeBtnStyles from "../TaskTypeButtons.module.css";
import type {TaskType} from "../TaskModels";
import {TASK_TYPE_LABELS_RU} from "../TaskModels";
import {default as ChooseRightVariantIcon} from "../IconsSVG/ChooseRightVariant.svg?react";
import {default as ConnectImageToTextIcon} from "../IconsSVG/ConnectImageToText.svg?react";
import {default as ConnectTranslationToWordIcon} from "../IconsSVG/ConnectTranslationToWord.svg?react";
import {default as ConnectAudioToTranslationIcon} from "../IconsSVG/ConnectAudioToTranslation.svg?react";
import {default as FillInTheBlanksIcon} from "../IconsSVG/FillInTheBlanks.svg?react";
import {default as ListenIcon} from "../IconsSVG/Listen.svg?react";
import {default as PickRightWordsIcon} from "../IconsSVG/PickRightWords.svg?react";
import {default as QuestionIcon} from "../IconsSVG/Question.svg?react";
import {default as ReadIcon} from "../IconsSVG/Read.svg?react";
import {default as RememberIcon} from "../IconsSVG/Remember.svg?react";
import {default as RepeatIcon} from "../IconsSVG/Repeat.svg?react";
import {default as SetTheStressIcon} from "../IconsSVG/SetTheStress.svg?react";
import {default as SpeakIcon} from "../IconsSVG/Speak.svg?react";
import {default as TaskIcon} from "../IconsSVG/Task.svg?react";
import {default as WriteIcon} from "../IconsSVG/Write.svg?react";

const ALL_TASK_TYPES: TaskType[] = [
    "WRITE",
    "LISTEN",
    "READ",
    "SPEAK",
    "REPEAT",
    "REMIND",
    "MARK",
    "FILL",
    "CONNECT_AUDIO",
    "CONNECT_IMAGE",
    "CONNECT_TRANSLATE",
    "SELECT",
    "TASK",
    "QUESTION",
    "SET_THE_STRESS",
    "CONTENT_BLOCKS",
];

const TASK_TYPE_ICON_COMPONENT: Record<TaskType, React.ComponentType<any>> = {
    WRITE: WriteIcon,
    LISTEN: ListenIcon,
    READ: ReadIcon,
    SPEAK: SpeakIcon,
    REPEAT: RepeatIcon,
    REMIND: RememberIcon,
    MARK: PickRightWordsIcon,
    FILL: FillInTheBlanksIcon,
    CONNECT_AUDIO: ConnectAudioToTranslationIcon,
    CONNECT_IMAGE: ConnectImageToTextIcon,
    CONNECT_TRANSLATE: ConnectTranslationToWordIcon,
    SELECT: ChooseRightVariantIcon,
    TASK: TaskIcon,
    QUESTION: QuestionIcon,
    SET_THE_STRESS: SetTheStressIcon,
    CONTENT_BLOCKS: TaskIcon,
};

export function TaskTypesPicker({selected, onToggle, disabled}: {
    selected: TaskType[];
    onToggle: (t: TaskType) => void;
    disabled?: boolean;
}) {
    return (
        <div className={styles.card}>
            <div className={styles.label} style={{marginBottom: 8, fontWeight: 600}}>Значки</div>
            <div className={taskTypeBtnStyles.grid}>
                {ALL_TASK_TYPES.map((t) => {
                    const active = selected.includes(t);
                    const SvgComp = TASK_TYPE_ICON_COMPONENT[t];
                    if (!SvgComp) return null;
                    return (
                        <button
                            key={t}
                            type="button"
                            aria-pressed={active}
                            disabled={disabled}
                            onClick={() => !disabled && onToggle(t)}
                            className={`${taskTypeBtnStyles.btn} ${active ? taskTypeBtnStyles.active : ""}`}
                            title={TASK_TYPE_LABELS_RU?.[t] || t}
                        >
                            <SvgComp className={`${taskTypeBtnStyles.icon} ${active ? "" : taskTypeBtnStyles.inactive}`}/>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

