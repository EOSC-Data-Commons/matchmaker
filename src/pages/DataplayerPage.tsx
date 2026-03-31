import { JSX, useEffect, useState } from "react";
import {useSearchParams, useNavigate} from 'react-router';

import { FileMeta } from "@/lib/grpcClient";

import {Footer} from '../components/Footer';
import dataCommonsIconBlue from '@/assets/data-commons-icon-blue.svg';
import eoscLogo from '@/assets/logo-eosc-data-commons.svg';

export const DataplayerPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [files, setFiles] = useState<FileMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // TODO: streaming file from backend. Backend use grpc and already streaming files.
    // This is a large dataset to test the streaming, would be super cool to 
    // test set:
    // const datasetHandle = "https://osf.io/3ua2c/";

    const datasetHandle = searchParams.get('datasetId');
    const datasetTitle = searchParams.get('title');

    useEffect(() => {
        const load = async () => {
            console.log("Start loading");
            try {
                setLoading(true);
                // TODO: I should wrap api call in a function so it is well typed.
                const res = await fetch(`/api/coordinator/files?handle=${encodeURIComponent(datasetHandle)}`);
                const files = await res.json();
                console.log("Fetched data");
                setFiles(files);
            } catch (err) {
                console.error(err);
                setError("Failed to fetch files");
            } finally {
                setLoading(false);
                console.log("Finished loading");
            }
        };

        load();
    }, [datasetHandle]);

    let content: JSX.Element | null;
    if (loading) {
        content = <div className="text-gray-600">Loading...</div>;
    } else if (error) {
        content = <div className="text-red-500">{error}</div>;
    } else if (!files.length) {
        content = <div className="text-gray-500">No files found</div>;
    } else {
        content = (
            <ul style={{ listStyle: "none", padding: 0 }}>
                {files.map((file) => (
                    <li
                        key={file.dataPath}
                        className="flex justify-between items-center p-2 border-b border-gray-200"
                    >
                        <div>
                            {file.isDir ? "📁" : "📄"} {file.filename}
                        </div>

                        <div className="flex gap-4 items-center">
                            {!file.isDir && <span className="text-gray-600">{file.size}</span>}
                            {file.downloadUrl && (
                                <a
                                    href={file.downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline"
                                >
                  Download
                                </a>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <header className="border-b border-gray-200 bg-white">
                <div className="container mx-auto px-4 py-3 sm:py-4">
                    <div className="flex items-center justify-between">
                        <div
                            className="flex items-center space-x-2 sm:space-x-3 cursor-pointer"
                            onClick={() => navigate("/")}
                        >
                            <img
                                src={dataCommonsIconBlue}
                                alt="Data Commons"
                                className="h-8 w-8 sm:h-10 sm:w-10"
                            />
                            <div className="flex flex-col space-y-0.5 sm:space-y-1">
                                <img
                                    src={eoscLogo}
                                    alt="EOSC Data Commons"
                                    className="h-6 sm:h-8 w-auto"
                                />
                                <p className="text-xs sm:text-sm text-gray-600">
                  Playing with data...
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex-1 min-w-0 p-4">
                {datasetTitle && (
                    <div className="mb-4 p-4 bg-white rounded border">
                        <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1">
              Dataset:
                        </p>
                        <p className="text-sm sm:text-base text-gray-900 wrap-break-words">
                            {datasetTitle}
                        </p>
                    </div>
                )}

                <div className="bg-white rounded border p-4">
                    <h2 className="text-lg font-semibold mb-2">Files</h2>
                    {content}
                </div>
            </div>

            <Footer />
        </div>
    );
};

export default DataplayerPage;
