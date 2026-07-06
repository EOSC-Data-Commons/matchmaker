import {LoaderIcon, FolderX} from 'lucide-react';
import {FileMeta} from '@/types/dataplayerTypes';
import {FileTree} from '@/components/dataplayer/FileTree';

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
                className="p-8 text-center bg-white rounded-lg border border-eosc-border flex flex-col items-center justify-center gap-3 min-h-18.75">
                <FolderX className="h-8 w-8 text-eosc-gray shrink-0"/>
                <div>
                    <p className="text-sm font-light text-eosc-text">No accessible files for this dataset.</p>
                    <p className="text-sm font-light text-eosc-gray mt-1">
                        It may not be published with downloadable files, or they aren't reachable through the sandbox.
                        Try opening the dataset at its source repository.
                    </p>
                </div>
            </div>
        );
    }

    return <FileTree files={files}/>;
};