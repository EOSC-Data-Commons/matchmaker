import {BackendDataset} from "@/types/commons.ts";

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
}

export interface Message {
    sender: 'user' | 'bot';
    content: string;
    hits?: BackendDataset[];
}
