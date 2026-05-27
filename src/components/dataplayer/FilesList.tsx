import {LoaderIcon} from 'lucide-react';
import {FileMeta} from '@/types/dataplayerTypes';

interface FilesListProps {
    files: FileMeta[];
    isFilesLoading: boolean;
    error: string | null;
}

export const FilesList = ({files, isFilesLoading, error}: FilesListProps) => {
    if (isFilesLoading) {
        return (
            <div
                className="p-4 bg-eosc-bg rounded-lg border border-eosc-border flex items-center gap-3 shadow-sm">
                <LoaderIcon className="h-5 w-5 text-eosc-light-blue animate-spin shrink-0"/>
                <p className="text-sm font-medium text-eosc-dark-blue">Loading files from FileMetrix...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 shadow-sm">
                <p className="text-sm text-red-600 font-medium break-words">{error}</p>
            </div>
        );
    }

    if (!files || !files.length) {
        return (
            <div className="p-8 text-center bg-eosc-bg rounded-lg border border-eosc-border shadow-sm">
                <p className="text-sm text-eosc-gray font-medium">No files found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-eosc-border shadow-sm overflow-hidden">
            <ul className="divide-y divide-eosc-border m-0 p-0">
                {files.map((file) => (
                    <li
                        key={file.dataPath}
                        className="flex flex-col sm:flex-row justify-between sm:items-center p-4 hover:bg-gray-50 transition-colors gap-3"
                    >
                        <div
                            className="text-sm text-eosc-text font-medium flex items-center gap-2 break-all overflow-hidden flex-1">
                            <span className="shrink-0 text-lg">{file.isDir ? "📁" : "📄"}</span>
                            <span>{file.filename}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm shrink-0">
                            {!file.isDir && (
                                <span
                                    className="text-eosc-gray px-2 py-1 bg-gray-100 rounded text-xs font-semibold">{file.size}</span>
                            )}
                            {file.downloadUrl && (
                                <a
                                    href={file.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-eosc-light-blue hover:text-eosc-dark-blue font-medium transition-colors border border-transparent hover:border-eosc-light-blue px-3 py-1.5 rounded-md"
                                >
                                    Download
                                </a>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
