import {useSyncExternalStore} from "react";
import {getChatRuns, getServerChatRuns, subscribeToChatRuns, type ChatRun} from "@/lib/chatRuns.ts";

/** Every chat run of this page visit, newest first, re-rendering on each streamed event. */
export const useChatRuns = (): readonly ChatRun[] =>
    useSyncExternalStore(subscribeToChatRuns, getChatRuns, getServerChatRuns);
