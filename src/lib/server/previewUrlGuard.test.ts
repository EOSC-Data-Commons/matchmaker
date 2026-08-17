import {describe, expect, it} from "vitest";

import {isPublicIpAddress, isSafePublicUrl, resolvesToPublicAddress} from "./previewUrlGuard";

describe("isPublicIpAddress", () => {
    it("accepts ordinary public addresses", () => {
        for (const ip of ["8.8.8.8", "1.1.1.1", "188.184.100.182", "2001:4860:4860::8888"]) {
            expect(isPublicIpAddress(ip), ip).toBe(true);
        }
    });

    it("rejects loopback, private, link-local and reserved IPv4", () => {
        const blocked = [
            "0.0.0.0", "127.0.0.1", "127.1.2.3",
            "10.0.0.1", "172.16.0.1", "172.31.255.255", "192.168.1.1",
            "169.254.169.254", // cloud metadata
            "100.64.0.1", "192.0.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255",
        ];
        for (const ip of blocked) {
            expect(isPublicIpAddress(ip), ip).toBe(false);
        }
    });

    it("keeps public neighbours of blocked ranges reachable", () => {
        // Off-by-one guards: these sit just outside the CIDRs above.
        for (const ip of ["172.15.255.255", "172.32.0.1", "100.128.0.1", "198.20.0.1", "11.0.0.1"]) {
            expect(isPublicIpAddress(ip), ip).toBe(true);
        }
    });

    it("rejects loopback, unique-local, link-local and multicast IPv6", () => {
        for (const ip of ["::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1"]) {
            expect(isPublicIpAddress(ip), ip).toBe(false);
        }
    });

    it("sees through IPv4-mapped IPv6, which is the usual way past a naive check", () => {
        expect(isPublicIpAddress("::ffff:127.0.0.1")).toBe(false);
        expect(isPublicIpAddress("::ffff:169.254.169.254")).toBe(false);
        expect(isPublicIpAddress("::ffff:8.8.8.8")).toBe(true);
    });

    it("rejects malformed addresses rather than defaulting to allowed", () => {
        for (const ip of ["", "not-an-ip", "1::2::3", "fe80::zz"]) {
            expect(isPublicIpAddress(ip), ip).toBe(false);
        }
    });
});

describe("isSafePublicUrl", () => {
    it("accepts the repository URLs the previewer actually uses", () => {
        for (const url of [
            "https://zenodo.org/api/records/7702229/files/small_reg.png/content",
            "http://example.org/data.csv",
        ]) {
            expect(isSafePublicUrl(url), url).toBe(true);
        }
    });

    it("rejects non-http schemes", () => {
        for (const url of ["file:///etc/passwd", "ftp://example.org/x", "gopher://example.org"]) {
            expect(isSafePublicUrl(url), url).toBe(false);
        }
    });

    it("rejects loopback names and private literals", () => {
        for (const url of [
            "http://localhost/x",
            "http://foo.localhost/x",
            "http://printer.local/x",
            "http://127.0.0.1/x",
            "http://169.254.169.254/latest/meta-data/",
            "http://[::1]/x",
            "http://[::ffff:127.0.0.1]/x",
        ]) {
            expect(isSafePublicUrl(url), url).toBe(false);
        }
    });

    it("rejects garbage", () => {
        expect(isSafePublicUrl("")).toBe(false);
        expect(isSafePublicUrl("not a url")).toBe(false);
    });
});

describe("resolvesToPublicAddress", () => {
    it("judges IP literals without a lookup", async () => {
        await expect(resolvesToPublicAddress("8.8.8.8")).resolves.toBe(true);
        await expect(resolvesToPublicAddress("127.0.0.1")).resolves.toBe(false);
        await expect(resolvesToPublicAddress("[::1]")).resolves.toBe(false);
    });

    it("rejects a name that does not resolve", async () => {
        await expect(
            resolvesToPublicAddress("no-such-host.invalid"),
        ).resolves.toBe(false);
    });
});
