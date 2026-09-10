import React, {useState} from 'react';
import type {BackendDataset} from "../types/commons.ts";
import {getAggregator, getOwner, getRepository, type RepoIdentity} from "../lib/repoProvenance.ts";

// One 96x40 slot for every logo, whatever shape its file is.
//
// The image is fitted whole into the slot and then scaled by the entry's `logoScale`, which brings
// each mark to the same optical area — see repoProvenance.ts for how those numbers are derived. That
// is why the slot clips: a media asset scales past the slot's edges, and what leaves the frame is
// the empty margin around the mark, never the mark itself, since the correction targets a mark no
// larger than 92x36 inside a 96x40 box. The transform is centred, and every asset centres its mark
// on its canvas, so the crop takes the same amount off each side.
const LOGO_SLOT = "h-10 w-24 shrink-0 overflow-hidden flex items-center justify-center";

// A logo <img> that falls back to `fallback` if the image fails to load.
const LogoImg: React.FC<{ src: string; alt: string; scale: number; fallback: React.ReactNode }> =
    ({src, alt, scale, fallback}) => {
        const [failed, setFailed] = useState(false);
        if (failed) return <>{fallback}</>;
        return (
            <span className={LOGO_SLOT}>
                <img src={src} alt={alt} className="h-full w-full object-contain"
                     style={{transform: `scale(${scale})`}} onError={() => setFailed(true)}/>
            </span>
        );
    };

const nameText = (name: string) => (
    <span className="text-sm text-gray-600 whitespace-nowrap">{name}</span>
);

// Wraps badge content in a link to the original repository / resource when we have one.
const MaybeLink: React.FC<{ href?: string | null; title: string; children: React.ReactNode }> =
    ({href, title, children}) => (
        href
            ? <a href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title}
                 className="shrink-0 inline-flex items-center">{children}</a>
            : <span title={title} aria-label={title} className="shrink-0 inline-flex items-center">{children}</span>
    );

// One provenance badge: the logo when we have a media asset for it, the name as text otherwise.
const Badge: React.FC<{ repo: RepoIdentity; title: string }> = ({repo, title}) => (
    <MaybeLink href={repo.href} title={title}>
        {repo.logo
            ? <LogoImg src={repo.logo} alt={`${repo.name} logo`} scale={repo.logoScale ?? 1}
                       fallback={nameText(repo.name)}/>
            : nameText(repo.name)}
    </MaybeLink>
);

/**
 * Provenance logos for a search hit. Aggregated records (harvested through OneData / OpenAIRE /
 * OpenAlex) show the repository owner (left) alongside the aggregator (right); records harvested
 * directly from a repository show that single repository logo. Renders nothing when the provenance
 * is unknown.
 */
export const RepoProvenance: React.FC<{ hit: BackendDataset }> = ({hit}) => {
    const aggregator = getAggregator(hit);

    if (aggregator) {
        const owner = getOwner(hit);
        // Combined tooltip so hovering anywhere in the cluster explains owner vs. aggregator.
        const groupTitle = owner
            ? `Owned by ${owner.name}, aggregated into EOSC Data Commons by ${aggregator.name}`
            : `Aggregated into EOSC Data Commons by ${aggregator.name}`;
        return (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1" title={groupTitle}>
                {owner && <Badge repo={owner} title={`Repository owner: ${owner.name}`}/>}
                <Badge repo={aggregator} title={`Data aggregator: ${aggregator.name}`}/>
            </div>
        );
    }

    const repo = getRepository(hit);
    if (repo) {
        return <Badge repo={repo} title={`Source repository: ${repo.name}`}/>;
    }
    return null;
};
