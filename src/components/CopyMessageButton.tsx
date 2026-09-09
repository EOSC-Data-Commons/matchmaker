import {useEffect, useRef, useState} from "react";
import {Check, Copy} from "lucide-react";
import useMatomo from "../hooks/useMatomo";

interface CopyMessageButtonProps {
    // The text placed on the clipboard.
    text: string;
}

/**
 * Copies a message to the clipboard, confirming with a tick for a moment.
 *
 * Sits beside the bubble rather than inside it, so it never reflows the message
 * text, and stays visible on touch screens, where there is no hover to reveal it.
 */
export const CopyMessageButton = ({text}: CopyMessageButtonProps) => {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const {trackEvent} = useMatomo();

    // The tick is on a timer, which has to be dropped if the message unmounts first.
    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (error) {
            // No clipboard permission, or an insecure origin. Nothing was copied, so
            // the button says nothing rather than claiming success.
            if (typeof console !== 'undefined') console.warn('Message copy failed', error);
            return;
        }
        trackEvent('Chat', 'message_copied');
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1500);
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            title={copied ? 'Copied' : 'Copy message'}
            aria-label={copied ? 'Message copied' : 'Copy message'}
            className="self-center shrink-0 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors cursor-pointer opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
        >
            {copied ? <Check className="h-4 w-4 text-green-600"/> : <Copy className="h-4 w-4"/>}
        </button>
    );
};
