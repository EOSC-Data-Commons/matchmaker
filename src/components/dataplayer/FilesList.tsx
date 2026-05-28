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
                className="p-4 bg-white rounded-lg border border-eosc-border flex items-center gap-3">
                <LoaderIcon className="h-5 w-5 text-eosc-light-blue animate-spin shrink-0"/>
                <p className="text-sm font-light text-eosc-text">Loading files from FileMetrix...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-600 font-light wrap-break-word">{error}</p>
            </div>
        );
    }

    if (!files || !files.length) {
        return (
            <div
                className="p-8 text-center bg-white rounded-lg border border-eosc-border flex items-center justify-center min-h-[75px]">
                <p className="text-sm font-light text-eosc-gray">No files found.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg border border-eosc-border overflow-hidden">
            <ul className="divide-y divide-eosc-border m-0 p-0">
                {files.map((file) => (
                    <li
                        key={file.dataPath}
                        className="flex flex-col sm:flex-row justify-between sm:items-center p-4 hover:bg-gray-50 transition-colors gap-3"
                    >
                        <div
                            className="text-sm text-eosc-text font-light flex items-start gap-2 break-all flex-1 min-w-0">
                            <span className="shrink-0 text-lg">{file.isDir ? "📁" : "📄"}</span>
                            <span className="break-all" title={file.filename}>{file.filename}</span>
                        </div>

                        <div className="flex items-center gap-4 text-sm shrink-0">
                            {!file.isDir && (
                                <span
                                    className="text-[#646363] px-2 py-1 bg-gray-50 border border-eosc-border rounded text-xs font-light">{file.size}</span>
                            )}
                            {file.downloadUrl && (
                                <button
                                    onClick={() => window.open(file.downloadUrl, '_blank')}
                                    className="text-eosc-light-blue hover:text-blue-500 font-light transition-colors border border-eosc-light-blue hover:border-eosc-dark-blue px-3 py-1.5 rounded-md text-sm bg-white hover:bg-gray-50 cursor-pointer"
                                >
                                    Download
                                </button>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
};
