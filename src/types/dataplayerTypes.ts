import { UserInfo } from "@/hooks/useAuth";

export interface ApiKeysResponse {
    keys: Record<string, string>;
}

export type ToolTyp = 
    | "FilesOnly"
    | "SlotsOnly"
    | "FilesAndSlots"
    | "DatasetOnly";

export interface ToolConfig {
    name: string;
    description: string;
    slots: ToolSlot[];
    typ: ToolTyp;
}

export type TypedValue =
    | boolean
    | string
    | number
    | FileMeta;

export type InputParameterTyp =
    | "Number"
    | "Text"
    | "File"
    | "Flag"
    | "Unknown";

export interface ToolSlot {
    name: string;
    typ: InputParameterTyp;
    id: string;
    isOptional: boolean;
}

export interface FileMeta {
    downloadUrl?: string;
    /** abs path as received from the server */
    dataPath: string;
    /** basename, same as dataPath for now — mirrors Rust impl */
    filename: string;
    /** human-readable decimal size string, e.g. "1.2 MB" */
    // XXX: is it good to use human-readable string size, I only display it or it involve with some calculation?
    size: string;
    hash: string | null;
    hash_type: string;
    isDir: boolean;
    mimetype?: string;
}

export type TaskId = string;

export interface DispatchResult {
    url?: string;
}

export type TypLaunchToolRequest = {
    userInfo: UserInfo;
    toolId: string;
    datasetUrl: string;
    datasetTitle: string;
    slotMapping: Record<string, TypedValue>,
    files: Record<string, FileMeta>,
};

// XXX: this need to sync with ToolState of protobuf
export type TaskState =
    | "PENDING"
    | "PREPARING"
    | "RUNNING"
    | "READY"
    | "DROPPED"
    | "UNKNOWN"
    | "EXCEPTION"

export interface TaskStatus {
    state: TaskState;
    message: string;
};
