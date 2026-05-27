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
                className="mt-4 sm:mt-6 p-3 sm:p-4 bg-eosc-bg rounded-lg border border-eosc-border flex items-center gap-2 sm:gap-3">
                <LoaderIcon className="h-4 w-4 sm:h-5 sm:w-5 text-eosc-light-blue animate-spin shrink-0"/>
                <p className="text-sm sm:text-base text-eosc-dark-blue">Loading files from FileMetrix...</p>
            </div>
        );
    }

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    if (!files || !files.length) {
        return <div className="text-eosc-gray">No files found</div>;
    }

    return (
        <ul style={{listStyle: "none", padding: 0}}>
            {files.map((file) => (
                <li
                    key={file.dataPath}
                    className="flex justify-between items-center p-2 border-b border-eosc-border"
                >
                    <div className="text-eosc-text">
                        {file.isDir ? "📁" : "📄"} {file.filename}
                    </div>

                    <div className="flex gap-4 items-center">
                        {!file.isDir && (
                            <span className="text-eosc-gray">{file.size}</span>
                        )}
                        {file.downloadUrl && (
                            <a
                                href={file.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-eosc-light-blue hover:underline"
                            >
                                Download
                            </a>
                        )}
                    </div>
                </li>
            ))}
        </ul>
    );
};

