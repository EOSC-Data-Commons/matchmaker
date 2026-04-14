export interface ToolConfig {
  name: string;
  description: string;
  slots: string[];
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
  toolId: string;
  slotToFileMapping: Record<string, FileMeta>;
};
