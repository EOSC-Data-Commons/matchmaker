import {sendChatMessage, RateLimitError, ServerError, type SSEEvent} from "@/lib/api.ts";
import {applyChatEvent, finalizeStream} from "@/lib/chatMessages.ts";
import type {Message} from "@/types/chat.ts";

/**
 * Chat runs that outlive the view that started them.
 *
 * A run is one assistant turn streamed from `/api/search/chat`. It belongs to the
 * conversation it was sent in, not to whichever conversation is on screen: starting
 * a new chat or opening another thread leaves it running, its events keep landing
 * in its own entry here, and opening its conversation again shows it where it got
 * to. The store is module state so a run also survives leaving `/chat` inside the
 * app. A reload or a closed tab still ends it, because the backend stops a run once
 * its connection drops; while any run is going the page asks before unloading.
 *
 * Runs are only ever started from the browser, so this module state is never
 * shared between users on the SSR server.
 */

export type RunStatus = 'running' | 'finished' | 'failed' | 'stopped';

export interface ChatRun {
    /** Unique per run; a conversation keeps its key across runs. */
    runId: number;
    /** Conversation id the run was started under: a thread id, or a local `new-…` id. */
    key: string;
    /** Backend thread id; for a new conversation it arrives with RUN_STARTED. */
    threadId?: string;
    /** Sidebar title until the backend lists the conversation, which it does once the run is stored. */
    title: string;
    /** The whole thread, earlier turns included, so it can be shown without a fetch. */
    messages: Message[];
    status: RunStatus;
    /** False from the moment the run ends until its conversation is shown. */
    seen: boolean;
}

interface StartRunOptions {
    key: string;
    threadId?: string;
    title: string;
    /** The thread so far, ending with the user message this run answers. */
    messages: Message[];
    model: string;
    /** Called with each event applied to the thread, and the thread after it. */
    onEvent?: (event: SSEEvent, messages: Message[]) => void;
    /** Called with each failure that ends in an error bubble. */
    onError?: (error: unknown) => void;
}

const EMPTY: readonly ChatRun[] = [];

let runs: readonly ChatRun[] = EMPTY;
let nextRunId = 1;
const listeners = new Set<() => void>();
const controllers = new Map<number, AbortController>();

const warnBeforeUnload = (event: BeforeUnloadEvent) => {
    event.preventDefault();
    // Older Chrome and Safari only prompt when returnValue is set as well.
    event.returnValue = '';
};
let guardingUnload = false;

const syncUnloadGuard = () => {
    const running = runs.some(run => run.status === 'running');
    if (running === guardingUnload || typeof window === 'undefined') return;
    guardingUnload = running;
    if (running) window.addEventListener('beforeunload', warnBeforeUnload);
    else window.removeEventListener('beforeunload', warnBeforeUnload);
};

const emit = (next: readonly ChatRun[]) => {
    runs = next;
    syncUnloadGuard();
    listeners.forEach(listener => listener());
};

const patch = (runId: number, update: (run: ChatRun) => ChatRun) => {
    // A run discarded while still streaming has no entry left to update.
    if (!runs.some(run => run.runId === runId)) return;
    emit(runs.map(run => (run.runId === runId ? update(run) : run)));
};

export const subscribeToChatRuns = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

/** Current runs, newest first. The array is replaced on every change. */
export const getChatRuns = (): readonly ChatRun[] => runs;

/** Snapshot for server rendering, where no run exists. */
export const getServerChatRuns = (): readonly ChatRun[] => EMPTY;

/** The run of conversation `id`, matched on the id it started under or the thread id it was given. */
export const findRun = (list: readonly ChatRun[], id: string | undefined): ChatRun | undefined =>
    id === undefined ? undefined : list.find(run => run.key === id || run.threadId === id);

// Turn a stream failure into the text of a user-facing error bubble.
const errorText = (error: unknown): string => {
    if (error instanceof RateLimitError || error instanceof ServerError) return error.message;
    if (error instanceof Error && /timeout|timed out/i.test(error.message)) {
        return "The search timed out — please try again.";
    }
    return "Something went wrong while searching. Please try again.";
};

/**
 * Starts a run and streams it into the store. Resolves once the run has ended,
 * however it ended; failures become an error bubble in the thread, never a rejection.
 * A conversation has one run at a time: the call is ignored while one is going, and
 * otherwise the new run replaces the conversation's previous one.
 */
export const startRun = async (
    {key, threadId, title, messages, model, onEvent, onError}: StartRunOptions
): Promise<void> => {
    const previous = findRun(runs, threadId ?? key);
    if (previous?.status === 'running') return;

    const runId = nextRunId++;
    const controller = new AbortController();
    controllers.set(runId, controller);
    emit([
        {runId, key, threadId, title, messages, status: 'running', seen: true},
        ...runs.filter(run => run !== previous),
    ]);

    // The whole assistant turn is reduced into this local list, then pushed to the
    // store on every event so tool calls and text appear as they stream in.
    let streamed = messages;
    let failed = false;
    const publish = () => patch(runId, run => ({...run, messages: streamed}));

    // The bubble goes into `streamed` too, or the next publish would drop it. Hands
    // `onError` the raw error rather than the formatted text, from the one place every
    // failure path converges on.
    const appendErrorBubble = (error: unknown) => {
        failed = true;
        onError?.(error);
        streamed = [...finalizeStream(streamed), {sender: 'bot', content: errorText(error), isError: true}];
        publish();
    };

    try {
        await sendChatMessage(
            messages,
            model,
            threadId,
            (event) => {
                // Stopping aborts the request, but events already read off the wire can still arrive.
                if (controller.signal.aborted) return;
                if (event.type === 'RUN_STARTED') {
                    const id = event.thread_id;
                    if (id) patch(runId, run => (run.threadId ? run : {...run, threadId: id}));
                    return;
                }
                if (event.type !== 'RUN_ERROR' && event.error) {
                    console.error("Event error:", event.error);
                    appendErrorBubble(new Error(event.error));
                    return;
                }
                streamed = applyChatEvent(streamed, event);
                publish();
                onEvent?.(event, streamed);
            },
            (error) => {
                console.error("Failed to send message", error);
                appendErrorBubble(error);
            },
            controller.signal
        );
    } catch (error) {
        console.error("Failed to send message", error);
        appendErrorBubble(error);
    } finally {
        controllers.delete(runId);
        // A stream that ends without RUN_FINISHED would otherwise leave the message
        // flagged as still streaming.
        streamed = finalizeStream(streamed);
        const status: RunStatus = controller.signal.aborted ? 'stopped' : failed ? 'failed' : 'finished';
        patch(runId, run => ({...run, messages: streamed, status, seen: false}));
    }
};

/** Stops a running run. What it produced so far stays in the thread. */
export const stopRun = (id: string) => {
    const run = findRun(runs, id);
    if (run) controllers.get(run.runId)?.abort();
};

/** Records that the run's conversation has been shown since the run ended. */
export const markRunSeen = (id: string) => {
    const run = findRun(runs, id);
    if (run && !run.seen) patch(run.runId, r => ({...r, seen: true}));
};

/** Stops the run if it is still going and drops it, for a conversation that has been deleted. */
export const discardRun = (id: string) => {
    const run = findRun(runs, id);
    if (!run) return;
    controllers.get(run.runId)?.abort();
    controllers.delete(run.runId);
    emit(runs.filter(r => r !== run));
};
