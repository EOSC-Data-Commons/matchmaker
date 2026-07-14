import React, {useState} from 'react';
import type {BackendDataset} from "../types/commons.ts";
import {getAggregator, getOwner, getRepository, type RepoIdentity} from "../lib/repoProvenance.ts";

// A logo <img> that falls back to `fallback` if the image fails to load (some CDN logos are still
// pending upload — see repoProvenance.ts).
const LogoImg: React.FC<{ src: string; alt: string; className: string; fallback: React.ReactNode }> =
    ({src, alt, className, fallback}) => {
        const [failed, setFailed] = useState(false);
        if (failed) return <>{fallback}</>;
        return <img src={src} alt={alt} className={className} onError={() => setFailed(true)}/>;
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

// Left badge: the repository that owns the dataset. Renders its logo when we have one, otherwise the
// owner name as text — never a placeholder. Returns null when the owner is unknown.
const OwnerBadge: React.FC<{ owner: RepoIdentity | null }> = ({owner}) => {
    if (!owner) return null;
    const title = `Repository owner: ${owner.name}`;
    const content = owner.logo
        ? <LogoImg src={owner.logo} alt={`${owner.name} logo`}
                   className="h-8 w-8 shrink-0 rounded object-contain" fallback={nameText(owner.name)}/>
        : nameText(owner.name);
    return <MaybeLink href={owner.href} title={title}>{content}</MaybeLink>;
};

// A wide logo, used for the aggregator (right) and for the single-repository case.
const WideLogo: React.FC<{ repo: RepoIdentity; title: string }> = ({repo, title}) => {
    const content = repo.logo
        ? <LogoImg src={repo.logo} alt={`${repo.name} logo`} className="h-8 w-24 object-contain"
                   fallback={nameText(repo.name)}/>
        : nameText(repo.name);
    return <MaybeLink href={repo.href} title={title}>{content}</MaybeLink>;
};

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
            <div className="flex items-center gap-2" title={groupTitle}>
                <OwnerBadge owner={owner}/>
                <WideLogo repo={aggregator} title={`Data aggregator: ${aggregator.name}`}/>
            </div>
        );
    }

    const repo = getRepository(hit);
    if (repo) {
        return <WideLogo repo={repo} title={`Source repository: ${repo.name}`}/>;
    }
    return null;
};
