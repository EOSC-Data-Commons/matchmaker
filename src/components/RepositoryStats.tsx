import {useEffect, useMemo, useState} from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    LabelList,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {fetchRepositoryStats} from "@/lib/api.ts";
import {RepositoryStat, RepositoryStatsResponse} from "@/types/commons.ts";

// Brand palette (Tailwind eosc-* tokens are no-ops under v4, so hex is hardcoded)
const DARK_BLUE = "#002337";
const ACCENT_BLUE = "#009FE3";
const MID_BLUE = "#3b7dd8";
const GRAY = "#646363";

// Floor for how many subjects to show; the actual count scales up to fill the
// height of the repository chart (see subjectData) so the two columns stay
// balanced as repositories are added.
const MIN_SUBJECTS = 8;
const REPO_ROW_HEIGHT = 48;
const SUBJECT_ROW_HEIGHT = 36;

const formatNumber = (n: number) => n.toLocaleString();

const truncate = (text: string, max = 28) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

interface RepoBarDatum {
    code: string;
    name: string;
    datasets: number;
}

interface SubjectBarDatum {
    subject: string;
    count: number;
}

const RepoTooltip = ({active, payload}: {
    active?: boolean;
    payload?: Array<{ payload: RepoBarDatum }>;
}) => {
    if (!active || !payload?.length) return null;
    const datum = payload[0].payload;
    return (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm">
            <p className="text-sm font-medium text-[#002337]">{datum.name}</p>
            <p className="text-xs text-[#646363]">{datum.code}</p>
            <p className="text-sm text-[#009FE3] mt-1">{formatNumber(datum.datasets)} datasets</p>
        </div>
    );
};

const SubjectTooltip = ({active, payload}: {
    active?: boolean;
    payload?: Array<{ payload: SubjectBarDatum }>;
}) => {
    if (!active || !payload?.length) return null;
    const datum = payload[0].payload;
    return (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 shadow-sm max-w-xs">
            <p className="text-sm font-medium text-[#002337] break-words">{datum.subject}</p>
            <p className="text-sm text-[#009FE3] mt-1">{formatNumber(datum.count)} datasets</p>
        </div>
    );
};

interface ClickableTickProps {
    x?: number;
    y?: number;
    payload?: { value: string };
    selectedCode: string | null;
    onSelect: (code: string) => void;
}

// Custom Y-axis tick so the repository label is clickable too — handy when a
// bar is too small to click (e.g. repositories with very few datasets).
const ClickableTick = ({x, y, payload, selectedCode, onSelect}: ClickableTickProps) => {
    if (x === undefined || y === undefined || !payload) return null;
    const isSelected = payload.value === selectedCode;
    return (
        <text
            x={x}
            y={y}
            dy={4}
            textAnchor="end"
            fontSize={12}
            fontWeight={isSelected ? 600 : 400}
            fill={isSelected ? DARK_BLUE : ACCENT_BLUE}
            style={{cursor: "pointer"}}
            onClick={() => onSelect(payload.value)}
        >
            {payload.value}
        </text>
    );
};

export const RepositoryStats = () => {
    const [stats, setStats] = useState<RepositoryStatsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCode, setSelectedCode] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchRepositoryStats()
            .then((data) => {
                if (cancelled) return;
                setStats(data);
                setError(null);
            })
            .catch(() => {
                if (cancelled) return;
                setError("Statistics are temporarily unavailable.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Only repositories that actually have records (hide the "0" ones).
    const activeRepos: RepositoryStat[] = useMemo(() => {
        if (!stats) return [];
        return stats.repositories
            .filter((r) => r.record_count > 0)
            .sort((a, b) => b.datasets - a.datasets);
    }, [stats]);

    const repoData: RepoBarDatum[] = useMemo(
        () => activeRepos.map((r) => ({code: r.code, name: r.name, datasets: r.datasets})),
        [activeRepos]
    );

    // Default the drill-down to the largest repository (computed during render,
    // not stored — the explicit user selection wins once it exists).
    const effectiveCode = selectedCode ?? activeRepos[0]?.code ?? null;
    const selectedRepo = activeRepos.find((r) => r.code === effectiveCode) ?? null;

    // Height of the repository chart drives the layout; the subjects chart
    // matches it so the right column fills the same vertical space.
    const repoChartHeight = Math.max(repoData.length * REPO_ROW_HEIGHT, 240);

    const subjectData: SubjectBarDatum[] = useMemo(() => {
        if (!selectedRepo) return [];
        // Show as many subjects as fit the repo chart's height, but never fewer
        // than MIN_SUBJECTS and never more than the API actually returns.
        const fitCount = Math.round(repoChartHeight / SUBJECT_ROW_HEIGHT);
        const maxSubjects = Math.min(
            selectedRepo.top_subjects.length,
            Math.max(fitCount, MIN_SUBJECTS)
        );
        return selectedRepo.top_subjects
            .slice(0, maxSubjects)
            .map((s) => ({subject: s.subject, count: s.count}));
    }, [selectedRepo, repoChartHeight]);

    if (loading) {
        return (
            <div
                className="bg-white border border-eosc-border rounded-xl p-8 flex items-center justify-center min-h-[300px]">
                <p className="text-sm font-light text-[#646363] animate-pulse">Loading statistics…</p>
            </div>
        );
    }

    if (error || !stats || activeRepos.length === 0) {
        return (
            <div
                className="bg-white border border-eosc-border rounded-xl p-8 flex items-center justify-center min-h-[300px]">
                <p className="text-sm font-light text-[#646363]">
                    {error ?? "No statistics available."}
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-eosc-border rounded-xl p-4 sm:p-8">
            {/* KPI strip */}
            <div className="flex flex-wrap gap-6 sm:gap-12 mb-8 justify-center sm:justify-start">
                <div>
                    <p className="text-3xl sm:text-4xl font-light text-[#002337]">
                        {formatNumber(stats.total_datasets)}
                    </p>
                    <p className="text-sm font-light text-[#646363] mt-1">Datasets indexed</p>
                </div>
                <div>
                    <p className="text-3xl sm:text-4xl font-light text-[#002337]">
                        {activeRepos.length}
                    </p>
                    <p className="text-sm font-light text-[#646363] mt-1">Active repositories</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Datasets per repository */}
                <div>
                    <h4 className="text-base font-medium text-[#002337] mb-1">Datasets per repository</h4>
                    <p className="text-xs font-light text-[#646363] mb-4">
                        Select a repository to explore its top subjects
                    </p>
                    <ResponsiveContainer width="100%" height={repoChartHeight}>
                        <BarChart
                            layout="vertical"
                            data={repoData}
                            margin={{top: 0, right: 64, bottom: 0, left: 8}}
                        >
                            <CartesianGrid horizontal={false} stroke="#F0F0F0"/>
                            <XAxis type="number" hide/>
                            <YAxis
                                type="category"
                                dataKey="code"
                                width={96}
                                tick={<ClickableTick selectedCode={effectiveCode} onSelect={setSelectedCode}/>}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<RepoTooltip/>} cursor={{fill: "rgba(0,159,227,0.06)"}}/>
                            <Bar
                                dataKey="datasets"
                                radius={[0, 4, 4, 0]}
                                cursor="pointer"
                                onClick={(_data: unknown, index: number) => {
                                    const repo = repoData[index];
                                    if (repo) setSelectedCode(repo.code);
                                }}
                            >
                                {repoData.map((entry) => (
                                    <Cell
                                        key={entry.code}
                                        fill={entry.code === effectiveCode ? DARK_BLUE : ACCENT_BLUE}
                                    />
                                ))}
                                <LabelList
                                    dataKey="datasets"
                                    position="right"
                                    formatter={(v: number) => formatNumber(v)}
                                    style={{fontSize: 11, fill: GRAY}}
                                />
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top subjects for the selected repository */}
                <div>
                    <h4 className="text-base font-medium text-[#002337] mb-1">
                        Top subjects
                    </h4>
                    <p className="text-xs font-light text-[#646363] mb-4 truncate">
                        {selectedRepo?.name ?? ""}
                    </p>
                    {subjectData.length > 0 ? (
                        <ResponsiveContainer width="100%"
                                             height={Math.max(subjectData.length * SUBJECT_ROW_HEIGHT, 240)}>
                            <BarChart
                                layout="vertical"
                                data={subjectData}
                                margin={{top: 0, right: 56, bottom: 0, left: 8}}
                            >
                                <CartesianGrid horizontal={false} stroke="#F0F0F0"/>
                                <XAxis type="number" hide/>
                                <YAxis
                                    type="category"
                                    dataKey="subject"
                                    width={150}
                                    tick={{fontSize: 11, fill: GRAY}}
                                    tickFormatter={(v: string) => truncate(v)}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<SubjectTooltip/>} cursor={{fill: "rgba(59,125,216,0.06)"}}/>
                                <Bar dataKey="count" fill={MID_BLUE} radius={[0, 4, 4, 0]}>
                                    <LabelList
                                        dataKey="count"
                                        position="right"
                                        formatter={(v: number) => formatNumber(v)}
                                        style={{fontSize: 11, fill: GRAY}}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center min-h-[240px]">
                            <p className="text-sm font-light text-[#646363]">No subject data available.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RepositoryStats;
