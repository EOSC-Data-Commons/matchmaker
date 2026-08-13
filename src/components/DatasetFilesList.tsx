import {ExternalLinkIcon, FileIcon} from "lucide-react";
import type {DatasetFile} from "../types/commons.ts";
import {formatFileSize} from "../lib/utils";

interface DatasetFilesListProps {
    files: DatasetFile[];
}

/** The files of a dataset, as returned by the `get_dataset_files` tool. */
export const DatasetFilesList = ({files}: DatasetFilesListProps) => {
    if (files.length === 0) {
        return <p className="text-xs text-gray-500">No files found for this dataset.</p>;
    }

    return (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {files.map((file, index) => {
                const size = formatFileSize(file.size);
                const type = file.raw_metadata?.friendly_type || file.raw_metadata?.content_type;
                const meta = [type, size].filter(Boolean).join(' · ');

                return (
                    <li key={`${file.link || file.name}-${index}`} className="flex items-center gap-3 px-3 py-2">
                        <FileIcon className="h-4 w-4 shrink-0 text-gray-400"/>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-800 truncate" title={file.name}>{file.name}</p>
                            {meta && <p className="text-xs text-gray-500">{meta}</p>}
                        </div>
                        {file.link && (
                            <a
                                href={file.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open ${file.name}`}
                                className="shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
                            >
                                <ExternalLinkIcon className="h-4 w-4"/>
                            </a>
                        )}
                    </li>
                );
            })}
        </ul>
    );
};
