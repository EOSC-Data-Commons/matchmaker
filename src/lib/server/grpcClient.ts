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
 *   npm install @grpc/grpc-js
 *   npm install -D ts-proto grpc-tools typescript
 */

import * as grpc from "@grpc/grpc-js";

// These are all generated from your .proto by ts-proto
import {
    BrowseDatasetByUrlRequest,
    BrowseDatasetResponse,
    DataplayerServiceClient,
    DatasetServiceClient,
    FileEntry,
    LaunchToolRequest,
    Slot,
    ToolServiceClient,
    TypedValue as GrpcTypedValue,
} from "./generated/coordinator";

// re-export so it can be access from server.rs
export {
    GetArtifactRequest,
    GetToolRequest,
    MatchToolsByDataRequest,
    MonitorStateRequest,
    MonitorStateResponse,
    SearchToolsByTextRequest,
    ToolState_State,
} from "./generated/coordinator";

import type {FileMeta, InputParameterTyp, ToolSlot, TypedValue} from "../../types/dataplayerTypes.ts";

// const GRPC_TARGET = "129-132-86-131.net4.ethz.ch:443";
const GRPC_TARGET = "grpc.eosc-coordinator.ethz.ch:443";
// const GRPC_TARGET = "129.132.86.131:443";

// tls, used when coordinator is not with matchmaker in same private network.
// creds,
const creds = grpc.credentials.createSsl();

// NOTE: creds with CA, mTLS
// const CA_PAM = "/home/jyu/EOSC/dev-environment/ca.pem";
// const caCert = fs.readFileSync(CA_PAM);
// const creds_with_ca = grpc.credentials.createSsl(caCert);

// NOTE: if matchmaker and coordinator stay in same private network, use InsecureChannel.
// createInsecureChannel()
// function createInsecureChannel(): grpc.ChannelCredentials {
//     return grpc.credentials.createInsecure();
// }

const channel = creds;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// function slotToGrpcSlot(slot: ToolSlot): Slot {
//     return {
//         id: slot.id,
//         typ: slot.typ,
//         name: slot.name,
//     };
// }

export function GrpcSlotToSlot(slot: Slot): ToolSlot {
    let typ: InputParameterTyp = "Unknown";
    if (slot.typ === "number") {
        typ = "Number";
    }
    if (slot.typ === "file" || slot.typ === "data_input") {
        typ = "File";
    }
    if (slot.typ === "flag") {
        typ = "Flag";
    }
    if (slot.typ === "string") {
        typ = "Text";
    }
    return {
        id: slot.id,
        typ: typ,
        name: slot.name,
    };
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

export function valueToGrpcValue(value: TypedValue): GrpcTypedValue {
    if (typeof value === "string") {
        return {
            stringValue: value,
        };
    }

    if (typeof value === "number") {
        return {
            numberValue: value,
        };
    }

    if (typeof value === "boolean") {
        return {
            boolValue: value,
        };
    }

    throw new Error(`Unsupported TypedValue: ${value}, with type: ${typeof value}`);
}

// client as a singleton for long-live HTTP/2 
// FIXME: all users share same TCP connection, security no safe, do per user mapping singleton.
// On the server side the validation happens for every rpc.
let db_client: DatasetServiceClient | null = null;

export function getDatasetClient() {
    if (!db_client) {
        db_client = new DatasetServiceClient(
            GRPC_TARGET,
            channel,
        );
    }
    return db_client;
}

process.on("SIGINT", () => {
    console.log("SIGINT received: closing gRPC client...");
    // closes HTTP/2 channel to avoid resource leaking
    db_client?.close();
    process.exit();
});

process.on("SIGTERM", () => {
    console.log("SIGTERM received: closing gRPC client...");
    db_client?.close();
    process.exit();
});

function makeAuthMetadata(token: string): grpc.Metadata {
    const metadata = new grpc.Metadata();
    metadata.set("authorization", `Bearer ${token}`);
    return metadata;
}

// TODO: this is yet a blocking call that collect all files.
// It need to be lazily spit out files and pop in the browser page.
// this one goes to datahugger to get file metadata, it will merge into filemetrix requset
// to let it routing the data source.
export async function fetchDatasetFilesFromDatahuggerByUrl(
    handle: string,
    token: string,
): Promise<FileMeta[]> {
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

// data player service
// TODO: string as id is not a good type, use TaskId and ToolId to distinguish them can be more clear.
export async function launchTool(
    toolId: string,
    dataset: string,
    slotToValueMapping: Record<string, TypedValue>,
    slotToFileMapping: Record<string, FileMeta>,
    token: string,
): Promise<string> {
    const metadata = makeAuthMetadata(token);

    // XXX: if I deploy the grpc server with client in the same NAT, I can use insecure channel, but if goes to ethz deployment, should not.
    // Should use SSL for msg over wire.
    const client = new DataplayerServiceClient(
        GRPC_TARGET,
        channel,
    );

    const msgFileSlotsMapping: Record<string, FileEntry> = {};
    for (const k in slotToFileMapping) {
        msgFileSlotsMapping[k] = fileMetaToFileEntry(slotToFileMapping[k]);
    }

    const msgValueSlotsMapping: Record<string, GrpcTypedValue> = {};
    for (const k in slotToValueMapping) {
        msgValueSlotsMapping[k] = valueToGrpcValue(slotToValueMapping[k]);
    }

    const request: LaunchToolRequest = {
        toolId,
        dataset,
        valueSlotsMapping: msgValueSlotsMapping,
        fileSlotsMapping: msgFileSlotsMapping,
    }

    return new Promise((resolve, reject) => {
        client.launchTool(request, metadata, (error, response) => {
            if (error) {
                // TODO: more detail log needed
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
            channel,
        );
    }
    return player_client;
}

let toolsrc_client: ToolServiceClient | null = null;

export function getToolSrcClient() {
    if (!toolsrc_client) {
        toolsrc_client = new ToolServiceClient(
            GRPC_TARGET,
            channel,
        );
    }
    return toolsrc_client;
}
