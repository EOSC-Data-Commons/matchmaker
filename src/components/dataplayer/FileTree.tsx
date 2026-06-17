import {useMemo, useState} from 'react';
import {ChevronRight, Download, File as FileIcon, Folder, FolderOpen} from 'lucide-react';
import {FileMeta} from '@/types/dataplayerTypes';

interface TreeNode {
    /** the path segment, e.g. "data" or "README.txt" */
    name: string;
    /** full accumulated path, used as a stable key and expand-state id */
    path: string;
    isDir: boolean;
    /** present only on leaf (file) nodes */
    file?: FileMeta;
    children: TreeNode[];
}

/**
 * Build a nested tree from the flat file list by splitting each dataPath on "/".
 * The server marks every entry as a file (isDir is unreliable), so directories
 * are inferred purely from the path structure: any segment that is not the last
 * one in a path is treated as a folder.
 */
const buildFileTree = (files: FileMeta[]): TreeNode[] => {
    const roots: TreeNode[] = [];

    for (const file of files) {
        const segments = file.dataPath.split('/').filter(Boolean);
        let level = roots;
        let accPath = '';

        segments.forEach((segment, index) => {
            accPath = accPath ? `${accPath}/${segment}` : segment;
            const isLeaf = index === segments.length - 1;

            let node = level.find((n) => n.name === segment);
            if (!node) {
                node = {
                    name: segment,
                    path: accPath,
                    isDir: !isLeaf,
                    file: isLeaf ? file : undefined,
                    children: [],
                };
                level.push(node);
            }
            level = node.children;
        });
    }

    // folders first, then files, each alphabetical
    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach((n) => sortNodes(n.children));
    };
    sortNodes(roots);

    return roots;
};

/** collect every directory path so the tree can start fully expanded */
const collectDirPaths = (nodes: TreeNode[], acc: Set<string> = new Set()): Set<string> => {
    for (const node of nodes) {
        if (node.isDir) {
            acc.add(node.path);
            collectDirPaths(node.children, acc);
        }
    }
    return acc;
};

interface TreeRowProps {
    node: TreeNode;
    depth: number;
    expanded: Set<string>;
    onToggle: (path: string) => void;
}

const TreeRow = ({node, depth, expanded, onToggle}: TreeRowProps) => {
    const isOpen = expanded.has(node.path);
    // indent each level; base padding keeps content off the card edge
    const indentStyle = {paddingLeft: `${depth * 20 + 16}px`};

    if (node.isDir) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => onToggle(node.path)}
                    style={indentStyle}
                    className="w-full flex items-center gap-2 pr-4 py-2.5 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                >
                    <ChevronRight
                        className={`h-4 w-4 shrink-0 text-eosc-gray transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                    {isOpen
                        ? <FolderOpen className="h-4 w-4 shrink-0 text-[#3b7dd8]"/>
                        : <Folder className="h-4 w-4 shrink-0 text-[#3b7dd8]"/>}
                    <span className="text-sm text-eosc-text font-light break-all" title={node.name}>
                        {node.name}
                    </span>
                </button>
                {isOpen && node.children.map((child) => (
                    <TreeRow
                        key={child.path}
                        node={child}
                        depth={depth + 1}
                        expanded={expanded}
                        onToggle={onToggle}
                    />
                ))}
            </>
        );
    }

    const file = node.file;
    return (
        <div
            style={indentStyle}
            className="flex items-center gap-2 pr-4 py-2.5 hover:bg-gray-50 transition-colors"
        >
            {/* spacer matching the folder chevron so file names align under the folder label */}
            <span className="w-4 shrink-0"/>
            <FileIcon className="h-4 w-4 shrink-0 text-eosc-gray"/>
            <span className="text-sm text-eosc-text font-light break-all flex-1 min-w-0" title={node.name}>
                {node.name}
            </span>
            <div className="flex items-center gap-3 shrink-0">
                {file?.size && (
                    <span
                        className="text-[#646363] px-2 py-1 bg-gray-50 border border-eosc-border rounded text-xs font-light">
                        {file.size}
                    </span>
                )}
                {file?.downloadUrl && (
                    <button
                        type="button"
                        onClick={() => window.open(file.downloadUrl, '_blank')}
                        className="inline-flex items-center gap-1.5 leading-none text-eosc-light-blue hover:text-blue-500 font-light transition-colors border border-eosc-light-blue hover:border-eosc-dark-blue pl-2.5 pr-3 py-1.5 rounded-md text-sm bg-white hover:bg-gray-50 cursor-pointer"
                    >
                        <Download className="h-3.5 w-3.5 shrink-0"/>
                        <span>Download</span>
                    </button>
                )}
            </div>
        </div>
    );
};

interface FileTreeProps {
    files: FileMeta[];
}

export const FileTree = ({files}: FileTreeProps) => {
    const tree = useMemo(() => buildFileTree(files), [files]);
    const [expanded, setExpanded] = useState<Set<string>>(() => collectDirPaths(tree));

    const toggle = (path: string) => {
        setExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(path)) {
                next.delete(path);
            } else {
                next.add(path);
            }
            return next;
        });
    };

    return (
        <div className="bg-white rounded-lg border border-eosc-border overflow-hidden">
            <div className="divide-y divide-eosc-border">
                {tree.map((node) => (
                    <TreeRow
                        key={node.path}
                        node={node}
                        depth={0}
                        expanded={expanded}
                        onToggle={toggle}
                    />
                ))}
            </div>
        </div>
    );
};
