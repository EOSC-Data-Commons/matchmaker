// Logger utility for error handling and messaging

const isDev = import.meta.env.MODE === 'development';

export function logError(error: unknown, context?: string) {
    if (isDev) {
        // Detailed error in dev
        console.error(`[DEV ERROR]${context ? ' [' + context + ']' : ''}`, error);
    } else {
        // User-friendly error in prod
        console.error(`[ERROR]${context ? ' [' + context + ']' : ''}`, error instanceof Error ? error.message : String(error));
    }
}

export function getUserErrorMessage(error: unknown): string {
    if (isDev && error instanceof Error) {
        return `${error.message}\n${error.stack}`;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'An unexpected error occurred.';
}


/**
 * Wraps a fetch call with a timeout
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 60000 = 1 minute)
 */
export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 60000
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs / 1000} seconds. Please try again.`);
        }
        throw error;
    }
}

/**
 * Strips HTML tags and decodes basic HTML entities.
 * Safe for use in both browser and server environments (SSR).
 */
export function stripHtml(html: string): string {
    if (!html) return '';

    let text = html.replace(/<(script|style|noscript|iframe)[^>]*>[\s\S]*?<\/\1>/gi, '');
    text = text.replace(/<!--[\s\S]*?-->/g, '');
    text = text.replace(/<[^>]+>/g, '');
    const entities: Record<string, string> = {
        '&nbsp;': ' ',
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
        '&bull;': '•',
        '&middot;': '·',
    };

    return text.replace(/&(nbsp|amp|lt|gt|quot|#39|apos|copy|reg|trade|bull|middot);/g, (match) => {
        return entities[match] || match;
    });
}
