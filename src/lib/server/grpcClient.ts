/**
 * gRPC client — TypeScript port of the Rust implementation.
 *
 * Prerequisites — run once to generate types from your .proto:
 *
 *  npx protoc \
 *    --plugin=./node_modules/.bin/protoc-gen-ts_proto \
 *    --ts_proto_out=./src/lib/server/generated \
 *    --ts_proto_opt=outputServices=grpc-js,esModuleInterop=true,env=node,useOptionals=messages \
 *    --proto_path=./req-packager/proto \
 *    ./req-packager/proto/coordinator.proto
 *
 * Install deps:
 *   npm install @grpc/grpc-js jsonwebtoken
 *   npm install -D ts-proto grpc-tools @types/jsonwebtoken typescript
 */

import * as grpc from "@grpc/grpc-js";
import jwt from "jsonwebtoken";


// These are all generated from your .proto by ts-proto
import {
    BrowseDatasetByUrlRequest,
    BrowseDatasetRequest,
    BrowseDatasetResponse,
    DataplayerServiceClient,
    DatasetServiceClient,
    FileEntry,
    FindToolsRequest,
    LaunchToolRequest,
    ToolMeta,
    ToolServiceClient,
} from "./generated/coordinator.ts";

const GRPC_TARGET = "[::1]:50051";

// JWT-token mocking
// This supposed to provide from matchmaker login
const JWT_SECRET = "my_secret_key";
export function createToken(): string {
    return jwt.sign(
        { sub: "user123", name: "Alice", role: "admin" },
        JWT_SECRET,
        { expiresIn: 1_999_999_999 - Math.floor(Date.now() / 1000) },
    );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Application-level view of a file — mirrors the Rust `FileMeta` struct.
 * Converts the raw proto `FileEntry` into something more UI-friendly
 * (human-readable size, flattened path → filename).
 */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Decimal byte formatter — mirrors Rust `humansize::DECIMAL`. */
function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1);
    const value = bytes / Math.pow(1000, i);
    return `${Number.isInteger(value) ? value : value.toFixed(1)} ${units[i]}`;
}

/** mirrors Rust `impl From<grpc::FileEntry> for FileMeta` */
function fileEntryToFileMeta(entry: FileEntry): FileMeta {
    return {
        downloadUrl: entry.downloadUrl ?? undefined,
        dataPath: entry.path,
        filename: entry.path,
        size: formatBytes(entry.sizeBytes),
        hash: entry.checksum,
        hash_type: entry.checksumType,
        isDir: entry.isDir,
        mimetype: entry.mimeType ?? undefined,
    };
}

/** mirrors Rust `impl From<FileMeta> for grpc::FileEntry` */
// XXX: not well done on converting, same for the reverse convert above.
export function fileMetaToFileEntry(meta: FileMeta): FileEntry {
    return {
        downloadUrl: meta.downloadUrl ?? undefined,
        path: meta.dataPath,
        sizeBytes: 0, // FIXME: same as Rust — original size lost after display conversion
        isDir: meta.isDir,
        mimeType: meta.mimetype ?? undefined,
        checksum: undefined,
        modifiedAt: undefined,
    };
}

// client as a singleton for long-live HTTP/2 
// FIXME: all users share same TCP connection, security no safe, do per user mapping singleton.
// On the server side the validation happens for every rpc.
let db_client: DatasetServiceClient | null = null;
export function getDatasetClient() {
    if (!db_client) {
        db_client = new DatasetServiceClient(
            GRPC_TARGET,
            createInsecureChannel()
        );
    }
    return db_client;
}

process.on("SIGINT", () => {
    console.log("SIGINT received: closing gRPC client...");
    // closes HTTP/2 channel to avoid resource leaking
    db_client.close(); 
    process.exit();
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received: closing gRPC client...");
    db_client.close();
    process.exit();
});

function makeAuthMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    return metadata;
}

function createInsecureChannel(): grpc.ChannelCredentials {
    return grpc.credentials.createInsecure();
}

// fetchDatasetFiles — server-streaming RPC
// mirrors Rust `fetch_dataset_files`
// this one goes to DB to get file metadata
export async function fetchDatasetFilesFromDatadaseByUUID(
    uuid: string,
): Promise<FileMeta[]> {
    const token = createToken();
    const metadata = makeAuthMetadata(token);

    const client = getDatasetClient();

    const request: BrowseDatasetRequest = {
        uuid,
        urlDatarepo: "https://example.com/datasets",
        idDataset: "1",
    };

    return new Promise((resolve, reject) => {
        const stream = client.browseDataset(request, metadata);
        const files: FileMeta[] = [];

        stream.on("data", (resp: BrowseDatasetResponse) => {
            if (resp.fileEntry) {
                files.push(fileEntryToFileMeta(resp.fileEntry));
                return;
            }

            if (resp.datasetInfo) {
                return;
            }

            if (resp.progress) {
                return;
            }

            if (resp.complete) {
                // stream.cancel();
                return;
            }

            if (resp.error) {
                console.error("browse error:", resp.error);
                return;
            }
        });

        stream.on("end", () => {
            // XXX: should I close the client??
            client.close();
            resolve(files);
        });

        stream.on("error", (err: grpc.ServiceError) => {
            client.close();
            reject(err);
        });
    });
}

// TODO: this is yet a blocking call that collect all files.
// It need to be lazily spit out files and pop in the browser page.
// this one goes to datahugger to get file metadata, it will merge into filemetrix requset
// to let it routing the data source.
export async function fetchDatasetFilesFromDatahuggerByUrl(
    handle: string,
): Promise<FileMeta[]> {
    const token = createToken();
    const metadata = makeAuthMetadata(token);

    // XXX: in-efficient, create client as singlton
    // const client = new DatasetServiceClient(GRPC_TARGET, createInsecureChannel());
    const client = getDatasetClient();

    const request: BrowseDatasetByUrlRequest = {
        url: handle,
    };

    return new Promise((resolve, reject) => {
        const call = client.browseDatasetByUrl(request, metadata);
        const files: FileMeta[] = [];

        call.on("data", (resp: BrowseDatasetResponse) => {
            if (resp.fileEntry) {
                files.push(fileEntryToFileMeta(resp.fileEntry));
                return;
            }

            if (resp.datasetInfo) {
                return;
            }

            if (resp.progress) {
                return;
            }

            if (resp.complete) {
                return;
            }

            if (resp.error) {
                console.error("browse error:", resp.error);
                return;
            }
        });

        call.on("end", () => {
            resolve(files);
        });

        call.on("error", (err: grpc.ServiceError) => {
            reject(err);
        });
    });
}

// ---------------------------------------------------------------------------
// findTools — unary RPC
// mirrors Rust `find_tools`
// ---------------------------------------------------------------------------

export async function findTools(files: FileMeta[]): Promise<ToolMeta[]> {
    const token = createToken();
    const metadata = makeAuthMetadata(token);

    // TODO: in-efficient to create HTTP/2 channel every call, make it a singleton.
    const client = new ToolServiceClient(GRPC_TARGET, createInsecureChannel());

    const request: FindToolsRequest = {
        files: files.map(fileMetaToFileEntry),
    };

    return new Promise((resolve, reject) => {
        client.findTools(request, metadata, (err, response) => {
            // TODO: if go with singleton client, client should not close in the call.
            client.close();
            if (err) {
                reject(err);
                return;
            }
            resolve(response!.tools);
        });
    });
}

// data player service
// TODO: string as id is not a good type, use TaskId and ToolId to distinguish them can be more clear.
export async function launchTool(toolId: string, slotsMapping: Record<string, FileMeta>): Promise<string> {
    const token = createToken(); 
    const metadata = makeAuthMetadata(token);

    // XXX: if I deploy the grpc server with client in the same NAT, I can use insecure channel, but if goes to ethz deployment, should not.
    // Should use SSL for msg over wire.
    const client = new DataplayerServiceClient(GRPC_TARGET, createInsecureChannel());

    const msgSlotsMapping = {} as {string: FileEntry};
    for (const k in slotsMapping) {
        msgSlotsMapping[k] = fileMetaToFileEntry(slotsMapping[k]); 
    }

    const request: LaunchToolRequest = {
        toolId,
        slotsMapping: msgSlotsMapping,
    }

    return new Promise((resolve, reject) => {
        client.launchTool(request, metadata, (error, response) => {
            if (error) {
                // TODO: log needed?
                reject(error);
                return;
            }

            resolve(response.handlerId);
        }); 
    });
}

let player_client: DataplayerServiceClient | null = null;
export function getDataplayerClient() {
    if (!player_client) {
        player_client = new DataplayerServiceClient(
            GRPC_TARGET,
            createInsecureChannel()
        );
    }
    return player_client;
}

let toolsrc_client: ToolServiceClient | null = null;
export function getToolSrcClient() {
    if (!toolsrc_client) {
        toolsrc_client = new ToolServiceClient(
            GRPC_TARGET,
            createInsecureChannel()
        );
    }
    return toolsrc_client;
}
