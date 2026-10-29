import {RateLimitError, ServerError} from './api.ts';
import {getAggregator, getRepository} from './repoProvenance.ts';
import type {BackendDataset} from '@/types/commons.ts';

/*
 * Matomo tracking for site id 10 on egi.matomo.cloud.
 *
 * The account that reads these reports has view access only: no goals, no custom
 * dimensions, no funnels. Everything that needs to be measurable therefore has to
 * be expressed as something a viewer can segment on: event category, action and
 * name, site search keyword and category, and the page URL. Numbers travel in the
 * event value, never as events of their own, and free text travels only in site
 * search keywords, never in an event name.
 *
 * Every category and action is declared in `EventCatalogue` below together with
 * the names it accepts, so a call site cannot put a query, a title or an author
 * into a report by accident. Add a new event here first.
 */

export type ErrorKind = 'rate_limit' | 'server' | 'timeout' | 'network' | 'unknown';

/** How a plain search was started. */
export type SearchOrigin = 'typed' | 'history' | 'example';
export type FilterKey = 'publicationYear' | 'creator' | 'subject';
/** Where an AI Mode question came from and whether it opened a conversation. */
export type QuestionOrigin = 'from_landing' | 'from_search' | 'new' | 'follow_up';
/** Where a dataset card was shown when it was acted on. */
export type DatasetContext = 'search' | 'ai_results' | 'ai_cited' | 'ai_answer' | 'export';
/** `<context>:<repository code>`, built by `datasetEventName`. */
export type DatasetEventName = `${DatasetContext}:${string}`;
export type FeedbackContext = 'search' | 'ai_mode';
/** The control that started an interactive login. */
export type LoginTrigger =
    | 'header_landing'
    | 'header_search'
    | 'ai_mode_toggle'
    | 'play_button'
    | 'gate_chat'
    | 'gate_data_player'
    | 'gate_profile'
    | 'gate_export';
/** A page that asks for login before showing anything. */
export type GateName = 'chat' | 'data_player' | 'profile' | 'export';
export type PreviewKindName = 'text' | 'csv' | 'pdf' | 'image' | 'none';
export type ToolListOrigin = 'file_match' | 'text_search';
export type FairRequest = 'new' | 'recheck' | 'retry';
export type FairOutcome = 'completed' | 'completed_with_errors' | 'cached';
/** `unavailable` is the assessment service answering that it is down, as opposed to not answering. */
export type FairFailure = 'failed' | 'timeout' | 'network' | 'unavailable' | 'unknown';
export type FairAssessor = 'fuji' | 'fair_champion';
export type LandingTool = 'galaxy' | 'jupyterlab' | 'rstudio';

/**
 * Every event the app sends: category, action, and the names each action accepts.
 * `never` means the action carries no name. Where a comment says what a `string`
 * holds, it is an identifier from a closed set the backend owns (model name, agent
 * tool name, registry tool title, citation format), never user input.
 */
export interface EventCatalogue {
    Search: {
        submitted: SearchOrigin;
        /** Name: model. Value: latency in ms. The hit count goes to site search. */
        completed: string;
        failed: ErrorKind;
        retry_clicked: never;
        /** Value: number of active filters after the change. */
        filter_applied: FilterKey;
        filter_removed: FilterKey;
    };
    'AI Mode': {
        toggled: 'on' | 'off';
        /** Value: 1-based turn number in the conversation. The question text goes to site search. */
        question_sent: QuestionOrigin;
        /** Name: agent tool name. Value: hits that tool returned. */
        tool_called: string;
        /** Name: model. Value: ms from send to the first text token. */
        first_token: string;
        /** Name: model. Value: ms from send to the end of the run. */
        answer_completed: string;
        /** Value: ms until the failure. */
        answer_failed: ErrorKind;
        /** Name: model. Value: ms until the user stopped it. */
        answer_stopped: string;
        conversation_opened: 'sidebar' | 'url';
        conversation_deleted: never;
        new_conversation_clicked: never;
        message_copied: 'user' | 'assistant';
        /** An in-answer [n] pill jumped to the cited-datasets list. */
        reference_jumped: never;
        /** Name: title of the registry tool the agent found. */
        tool_link_opened: string;
        /** Value: number of messages exported. */
        exported: 'markdown' | 'pdf';
    };
    Dataset: {
        /** Value: 1-based position in the list it was shown in. */
        play_clicked: DatasetEventName;
        source_opened: DatasetEventName;
        details_expanded: 'description' | 'authors';
    };
    Citation: {
        opened: DatasetEventName;
        /** Name: citation format. */
        copied: string;
        downloaded: string;
    };
    Feedback: {
        thumbs_up: FeedbackContext;
        thumbs_down: FeedbackContext;
    };
    Auth: {
        gate_shown: GateName;
        login_started: LoginTrigger;
        /** The trigger stashed by `login_started`, or `unknown` if the stash was lost. */
        login_completed: LoginTrigger | 'unknown';
        logout: never;
        /** Once per browser session for a signed-in user: the only way to segment signed-in visits without a custom dimension. */
        signed_in_visit: never;
    };
    'Data Player': {
        /** Value: number of files. */
        files_loaded: never;
        files_failed: ErrorKind;
        /** Value: number of tools, 0 when none were found. */
        tools_listed: ToolListOrigin;
        /** Name: tool name from the registry config. Value: 1-based position in the list. */
        tool_selected: string;
        tool_config_failed: 'error' | 'timeout';
        /** Value: number of additional dataset groups after the change. */
        additional_dataset_added: never;
        additional_dataset_failed: never;
        /** Name: tool name. Value: number of files mapped. */
        launch_submitted: string;
        /** Name: tool name. Value: ms from submit to a ready task. */
        launch_succeeded: string;
        /** Name: `<tool name>:<reason>`, the task state or an error kind. Value: ms until failure. */
        launch_failed: `${string}:${string}`;
        /** Name: tool name. The user opened the launched tool: the conversion this whole flow exists for. */
        tool_opened: string;
        step_back: 'reselect_tool' | 'back_to_config' | 'start_over';
        file_downloaded: PreviewKindName;
    };
    'File Preview': {
        opened: PreviewKindName;
        /** Value: ms to load. */
        loaded: PreviewKindName;
        /** Name: HTTP status, or `unknown`. */
        failed: string;
    };
    FAIR: {
        check_requested: FairRequest;
        /** Value: ms from request to result; 0 for a cached result shown at once. */
        check_completed: FairOutcome;
        check_failed: FairFailure;
        /** Value: the assessor's overall score. */
        score: FairAssessor;
    };
    'API Keys': {
        store_unavailable: never;
        /** Name: `<key id>:set` the first time, `<key id>:replace` afterwards. */
        saved: `${string}:${'set' | 'replace'}`;
        /** Name: key id. */
        removed: string;
        save_failed: string;
        remove_failed: string;
    };
    Landing: {
        example_clicked: '1' | '2' | '3';
        tool_card_clicked: LandingTool;
        about_clicked: never;
    };
    Error: {
        /** Name: the error's constructor name, never its message. */
        react_boundary: string;
        /** Name: HTTP status or constructor name. */
        route_error: string;
        not_found: never;
    };
}

export type EventCategory = keyof EventCatalogue;
export type EventAction<C extends EventCategory> = keyof EventCatalogue[C] & string;

/** An action declared `never` takes no name; every other action requires one. */
type NameArgs<N> = [N] extends [never] ? [name?: undefined, value?: number] : [name: N, value?: number];

/** No-ops until `MatomoTracker` has installed `window._paq`, and on the server. */
const push = (cmd: Array<string | number | boolean>) => {
    if (typeof window === 'undefined' || !window._paq) return;
    window._paq.push(cmd);
};

/**
 * Pushes a Matomo event. Inside components prefer the `useMatomo` hook, which is
 * a thin wrapper around this; call it directly from the places a hook cannot
 * reach: class components, module-level code, and non-React helpers.
 */
export const trackEvent = <C extends EventCategory, A extends EventAction<C>>(
    category: C,
    action: A,
    ...args: NameArgs<EventCatalogue[C][A]>
) => {
    const [name, value] = args as [string | undefined, number | undefined];
    const cmd: Array<string | number> = ['trackEvent', category, action];
    // Matomo reads these positionally, so a value with no name still has to fill
    // the name slot or it lands in the wrong column.
    if (name !== undefined) cmd.push(name);
    else if (value !== undefined) cmd.push('');
    if (value !== undefined) cmd.push(value);
    push(cmd);
};

export const trackPageView = () => push(['trackPageView']);

/** Which of the two kinds of query a site search records. */
export type SiteSearchCategory = 'search' | 'ai';

/**
 * Records one action against Matomo's native Site Search reports. This is the
 * one place a query is recorded: plain searches under the `search` category and
 * AI Mode questions under `ai`, each with its result count, so the keyword, the
 * "no results" and the category reports work for both.
 *
 * Matomo documents it as a replacement for `trackPageView`, not an addition, so
 * `MatomoTracker` holds the pageview back for the navigation a plain search
 * reports on. An AI question is sent from inside the conversation page, which
 * has had its pageview already.
 */
export const trackSiteSearch = (keyword: string, category: SiteSearchCategory, resultCount: number | false) =>
    push(['trackSiteSearch', keyword, category, resultCount]);

/**
 * Records an outlink or a download that Matomo's automatic link tracking cannot
 * see because the app opens it with `window.open` instead of an anchor click.
 */
export const trackLink = (url: string, type: 'link' | 'download') => push(['trackLink', url, type]);

/**
 * The search keyword a location represents, or null if it is not a results page.
 * Kept next to `trackSiteSearch` so the pageview suppression and the replacement
 * action cannot drift apart. An empty `q` is excluded: it redirects home without
 * searching, and Matomo already files those under Pages rather than Site Search.
 */
export const siteSearchKeyword = (pathname: string, search: string): string | null =>
    pathname === '/search' ? (new URLSearchParams(search).get('q') || null) : null;

// Matomo reads campaign attribution from these on the page URL, so they have to
// survive `trackedUrl` or every tagged promotion link would count as direct.
const CAMPAIGN_PARAM = /^(mtm|utm|pk|matomo|piwik)_/i;

/**
 * The URL a location is reported to Matomo as. Reporting the raw URL gave every
 * conversation and every dataset its own row: the dataplayer carries the dataset
 * id and full title, so the Pages report had hundreds of rows of up to 350
 * characters and the overflow disappeared into "Others". Only campaign params
 * are kept, except on /search, whose `q` feeds Matomo's site search reports.
 * The tracker resolves the result against the current host, so prod, dev and
 * localhost stay distinguishable by `pageUrl` host.
 */
export const trackedUrl = (pathname: string, search: string): string => {
    // A leading `//` would be read as a protocol-relative URL, turning the first
    // path segment into a hostname.
    const path = pathname
        .replace(/^\/+/, '/')
        .replace(/^\/chat\/[^/]+\/export\/?$/, '/chat/:id/export')
        .replace(/^\/chat\/[^/]+\/?$/, '/chat/:id');
    if (path === '/search') return path + search;
    const kept = new URLSearchParams();
    new URLSearchParams(search).forEach((value, key) => {
        if (CAMPAIGN_PARAM.test(key)) kept.append(key, value);
    });
    const query = kept.toString();
    return query ? `${path}?${query}` : path;
};

/**
 * A stable title per screen for Matomo's Page Titles report. The document title
 * is the same on every page, so without this the report has one row; with it,
 * each screen has clean totals however its URL varies.
 */
export const pageTitle = (pathname: string): string => {
    const path = pathname.replace(/^\/+/, '/').replace(/\/$/, '') || '/';
    if (path === '/') return 'Home';
    if (path === '/search') return 'Search results';
    if (/^\/chat\/[^/]+\/export$/.test(path)) return 'AI Mode export';
    if (path === '/chat' || path.startsWith('/chat/')) return 'AI Mode';
    if (path === '/dataplayer') return 'Data Player';
    if (path === '/profile') return 'API Keys';
    if (path === '/privacy-policy') return 'Privacy policy';
    if (path === '/acceptable-use-policy') return 'Acceptable use policy';
    return 'Not found';
};

const OPT_OUT_KEY = 'analyticsOptOut';

/**
 * Whether this browser sends anything to Matomo. A local dev server never does:
 * it used to report into the production site, where it made up nearly a fifth
 * of all recorded actions. Team members opt their own browser out by opening the
 * site once with `?analytics=off` (`?analytics=on` undoes it), so their own
 * visits stop being counted as users.
 */
export const analyticsEnabled = (hostname: string, search: string): boolean => {
    if (hostname === 'localhost' || hostname.endsWith('.localhost')
        || hostname === '127.0.0.1' || hostname === '[::1]') return false;
    const choice = new URLSearchParams(search).get('analytics');
    try {
        if (choice === 'off') localStorage.setItem(OPT_OUT_KEY, '1');
        else if (choice === 'on') localStorage.removeItem(OPT_OUT_KEY);
        return localStorage.getItem(OPT_OUT_KEY) !== '1';
    } catch {
        // Storage blocked: the opt-out cannot stick, but honour it for this load.
        return choice !== 'off';
    }
};

/**
 * True the first time it is called with `key` in this tab's session, false after.
 * For events that describe the visit rather than an action, such as
 * `Auth/signed_in_visit`, so they are not repeated on every page load. A new tab
 * starts a new session, which can repeat the event within one Matomo visit; a
 * segment on the event is unaffected, only its count is slightly high.
 */
export const onceInSession = (key: string): boolean => {
    try {
        if (sessionStorage.getItem(key)) return false;
        sessionStorage.setItem(key, '1');
        return true;
    } catch {
        // Without storage the event would repeat on every load, which is worse
        // than missing it.
        return false;
    }
};

/**
 * The event name for an action on a dataset card: where the card was shown and
 * which repository or aggregator the dataset came from. Those codes are a small
 * closed set, so the report stays readable, unlike the titles used before. The
 * owning institution is deliberately not used: it can be a hostname or an
 * organisation name, which would reopen the cardinality problem.
 */
export const datasetEventName = (context: DatasetContext, hit: BackendDataset): DatasetEventName =>
    `${context}:${(getAggregator(hit)?.code ?? getRepository(hit)?.code ?? 'unknown').toLowerCase()}`;

/**
 * Collapses an error into one of a small, stable set of labels for analytics.
 * Raw error messages carry request ids and status text, which would shatter the
 * Matomo report into thousands of single-occurrence rows.
 */
export const errorKind = (error: unknown): ErrorKind => {
    if (error instanceof RateLimitError) return 'rate_limit';
    if (error instanceof ServerError) return 'server';
    if (error instanceof Error) {
        if (/timeout|timed out|abort/i.test(error.message)) return 'timeout';
        if (/network|failed to fetch/i.test(error.message)) return 'network';
    }
    return 'unknown';
};
