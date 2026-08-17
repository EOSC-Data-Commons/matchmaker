// Address checks for the file-preview proxy.
//
// The proxy fetches a URL that ultimately came from outside: `/files` asks
// datahugger to browse a dataset handle the caller chose, and signs whatever
// download URLs come back. The signature proves we issued the URL, not that the
// URL is harmless, so the target still has to be checked before we connect.
//
// Checking the hostname text is not enough. `evil.example` resolving to
// 169.254.169.254 (cloud metadata) or 127.0.0.1 reads as perfectly public until
// you resolve it, so the resolved addresses are what we judge.

import {lookup} from "node:dns/promises";
import {isIPv4} from "node:net";

/** [network address, prefix length] pairs that must never be reachable. */
const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
    ["0.0.0.0", 8],        // "this network"
    ["10.0.0.0", 8],       // private
    ["100.64.0.0", 10],    // carrier-grade NAT
    ["127.0.0.0", 8],      // loopback
    ["169.254.0.0", 16],   // link-local, incl. cloud metadata
    ["172.16.0.0", 12],    // private
    ["192.0.0.0", 24],     // IETF protocol assignments
    ["192.168.0.0", 16],   // private
    ["198.18.0.0", 15],    // benchmarking
    ["224.0.0.0", 4],      // multicast
    ["240.0.0.0", 4],      // reserved, incl. 255.255.255.255
];

const ipv4ToInt = (ip: string): number =>
    ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;

function isPublicIpv4(ip: string): boolean {
    const value = ipv4ToInt(ip);
    return !BLOCKED_V4.some(([network, bits]) => {
        const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
        return (value & mask) === (ipv4ToInt(network) & mask);
    });
}

/** Expand an IPv6 address (including `::` compression) to its 16 bytes. */
function ipv6ToBytes(ip: string): number[] | null {
    const zone = ip.indexOf("%");
    const bare = zone >= 0 ? ip.slice(0, zone) : ip;

    const [head, tail, ...extra] = bare.split("::");
    if (extra.length > 0) return null;

    const parseGroups = (part: string): number[][] | null => {
        if (!part) return [];
        const groups: number[][] = [];
        for (const group of part.split(":")) {
            // a trailing IPv4 literal, as in ::ffff:127.0.0.1
            if (group.includes(".")) {
                if (!isIPv4(group)) return null;
                groups.push(group.split(".").map(Number));
                continue;
            }
            if (!/^[0-9a-f]{1,4}$/i.test(group)) return null;
            const value = Number.parseInt(group, 16);
            groups.push([value >> 8, value & 0xff]);
        }
        return groups;
    };

    const headBytes = parseGroups(head)?.flat();
    const tailBytes = tail === undefined ? [] : parseGroups(tail)?.flat();
    if (!headBytes || !tailBytes) return null;

    const gap = 16 - headBytes.length - tailBytes.length;
    if (tail === undefined) return headBytes.length === 16 ? headBytes : null;
    if (gap < 0) return null;

    return [...headBytes, ...new Array(gap).fill(0), ...tailBytes];
}

function isPublicIpv6(ip: string): boolean {
    const bytes = ipv6ToBytes(ip);
    if (!bytes) return false;

    // ::ffff:a.b.c.d and ::a.b.c.d carry an IPv4 address; judge it as IPv4.
    const firstTenZero = bytes.slice(0, 10).every((b) => b === 0);
    if (firstTenZero && bytes[10] === 0xff && bytes[11] === 0xff) {
        return isPublicIpv4(bytes.slice(12).join("."));
    }

    if (bytes.every((b) => b === 0)) return false;                    // ::
    if (firstTenZero && bytes[10] === 0 && bytes[11] === 0) {
        // ::1 (loopback) and other addresses inside ::/96
        return false;
    }
    if ((bytes[0] & 0xfe) === 0xfc) return false;                     // fc00::/7 unique-local
    if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) return false; // fe80::/10 link-local
    if (bytes[0] === 0xff) return false;                              // ff00::/8 multicast

    return true;
}

/** Is this literal address one we are willing to open a connection to? */
export function isPublicIpAddress(ip: string): boolean {
    return isIPv4(ip) ? isPublicIpv4(ip) : isPublicIpv6(ip);
}

/** Plain http(s) only. Rejects other schemes before anything tries to fetch. */
export function isSafePublicUrl(raw: string): boolean {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        return false;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;

    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".localhost")) return false;

    // A bare IP literal can be judged now; a name has to be resolved first, which
    // `resolvesToPublicAddress` does.
    const literal = host.startsWith("[") ? host.slice(1, -1) : host;
    if (isIPv4(literal) || literal.includes(":")) return isPublicIpAddress(literal);

    return true;
}

/**
 * Resolve a hostname and require every address it answers with to be public.
 *
 * Note this cannot be airtight: `fetch` resolves the name again when it
 * connects, so a DNS answer that changes between the two lookups (a rebinding
 * attack) is still possible. Closing that needs a pinned-address dispatcher.
 * This blocks the ordinary case, where a name simply points somewhere internal.
 */
export async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
    const bare = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
    if (isIPv4(bare) || bare.includes(":")) return isPublicIpAddress(bare);

    try {
        const addresses = await lookup(bare, {all: true});
        return addresses.length > 0 && addresses.every(({address}) => isPublicIpAddress(address));
    } catch {
        return false;
    }
}
