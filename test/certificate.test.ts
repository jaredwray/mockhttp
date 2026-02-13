import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as tls from "node:tls";
import { afterEach, describe, expect, test } from "vitest";
import {
	generateCertificate,
	generateCertificateFiles,
} from "../src/certificate.js";

describe("generateCertificate", () => {
	test("should return cert and key PEM strings", () => {
		const result = generateCertificate();
		expect(result.cert).toBeDefined();
		expect(result.key).toBeDefined();
		expect(typeof result.cert).toBe("string");
		expect(typeof result.key).toBe("string");
	});

	test("should return valid PEM format for cert", () => {
		const result = generateCertificate();
		expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
		expect(result.cert).toMatch(/\n-----END CERTIFICATE-----\n$/);
	});

	test("should return valid PEM format for key", () => {
		const result = generateCertificate();
		expect(result.key).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
		expect(result.key).toMatch(/\n-----END PRIVATE KEY-----\n$/);
	});

	test("should generate a parseable X.509 certificate", () => {
		const result = generateCertificate();
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509).toBeDefined();
		expect(x509.subject).toContain("CN=localhost");
	});

	test("should default to CN=localhost", () => {
		const result = generateCertificate();
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subject).toBe("CN=localhost");
		expect(x509.issuer).toBe("CN=localhost");
	});

	test("should support custom commonName", () => {
		const result = generateCertificate({ commonName: "my-test-server" });
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subject).toBe("CN=my-test-server");
		expect(x509.issuer).toBe("CN=my-test-server");
	});

	test("should include default Subject Alt Names", () => {
		const result = generateCertificate();
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subjectAltName).toContain("DNS:localhost");
		expect(x509.subjectAltName).toContain("IP Address:127.0.0.1");
	});

	test("should support custom altNames with DNS entries", () => {
		const result = generateCertificate({
			altNames: [
				{ type: "dns", value: "example.local" },
				{ type: "dns", value: "*.example.local" },
			],
		});
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subjectAltName).toContain("DNS:example.local");
		expect(x509.subjectAltName).toContain("DNS:*.example.local");
	});

	test("should support custom altNames with IP entries", () => {
		const result = generateCertificate({
			altNames: [
				{ type: "ip", value: "192.168.1.100" },
				{ type: "dns", value: "test.local" },
			],
		});
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subjectAltName).toContain("IP Address:192.168.1.100");
		expect(x509.subjectAltName).toContain("DNS:test.local");
	});

	test("should support custom validityDays", () => {
		const result = generateCertificate({ validityDays: 30 });
		const x509 = new crypto.X509Certificate(result.cert);
		const validTo = new Date(x509.validTo);
		const now = new Date();
		const diffDays = Math.round(
			(validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);
		// Allow 1 day tolerance for test timing
		expect(diffDays).toBeGreaterThanOrEqual(29);
		expect(diffDays).toBeLessThanOrEqual(31);
	});

	test("should support custom keySize", () => {
		const result = generateCertificate({ keySize: 4096 });
		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509).toBeDefined();
		expect(x509.subject).toBe("CN=localhost");
	});

	test("should generate a cert/key pair that works with TLS", () => {
		const result = generateCertificate();
		// This will throw if the cert/key don't match or are invalid
		const ctx = tls.createSecureContext({
			cert: result.cert,
			key: result.key,
		});
		expect(ctx).toBeDefined();
	});

	test("should handle validity dates past 2049 using GeneralizedTime", () => {
		// 10000 days from now will be past 2050
		const result = generateCertificate({ validityDays: 10000 });
		const x509 = new crypto.X509Certificate(result.cert);
		const validTo = new Date(x509.validTo);
		// The cert should be valid well past 2049
		expect(validTo.getUTCFullYear()).toBeGreaterThanOrEqual(2050);
		// Verify it's still parseable and valid
		const ctx = tls.createSecureContext({
			cert: result.cert,
			key: result.key,
		});
		expect(ctx).toBeDefined();
	});

	test("should generate unique certificates each time", () => {
		const result1 = generateCertificate();
		const result2 = generateCertificate();
		// Certificates should have different serial numbers
		expect(result1.cert).not.toBe(result2.cert);
		// Keys should be different
		expect(result1.key).not.toBe(result2.key);
	});
});

describe("generateCertificateFiles", () => {
	let tmpDir: string;

	afterEach(() => {
		if (tmpDir && fs.existsSync(tmpDir)) {
			fs.rmSync(tmpDir, { recursive: true });
		}
	});

	test("should write cert and key files to disk", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockhttp-cert-"));
		const certPath = path.join(tmpDir, "cert.pem");
		const keyPath = path.join(tmpDir, "key.pem");

		const result = await generateCertificateFiles({ certPath, keyPath });

		expect(fs.existsSync(certPath)).toBe(true);
		expect(fs.existsSync(keyPath)).toBe(true);

		const certContent = fs.readFileSync(certPath, "utf8");
		const keyContent = fs.readFileSync(keyPath, "utf8");

		expect(certContent).toBe(result.cert);
		expect(keyContent).toBe(result.key);
	});

	test("should write valid PEM files", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockhttp-cert-"));
		const certPath = path.join(tmpDir, "cert.pem");
		const keyPath = path.join(tmpDir, "key.pem");

		await generateCertificateFiles({ certPath, keyPath });

		const certContent = fs.readFileSync(certPath, "utf8");
		const keyContent = fs.readFileSync(keyPath, "utf8");

		expect(certContent).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
		expect(keyContent).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);

		// Verify the written cert is parseable
		const x509 = new crypto.X509Certificate(certContent);
		expect(x509.subject).toBe("CN=localhost");
	});

	test("should return the same CertificateResult", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockhttp-cert-"));
		const certPath = path.join(tmpDir, "cert.pem");
		const keyPath = path.join(tmpDir, "key.pem");

		const result = await generateCertificateFiles({ certPath, keyPath });

		expect(result.cert).toBeDefined();
		expect(result.key).toBeDefined();
		expect(result.cert).toMatch(/^-----BEGIN CERTIFICATE-----\n/);
		expect(result.key).toMatch(/^-----BEGIN PRIVATE KEY-----\n/);
	});

	test("should pass through certificate options", async () => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mockhttp-cert-"));
		const certPath = path.join(tmpDir, "cert.pem");
		const keyPath = path.join(tmpDir, "key.pem");

		const result = await generateCertificateFiles({
			certPath,
			keyPath,
			commonName: "custom-cn",
		});

		const x509 = new crypto.X509Certificate(result.cert);
		expect(x509.subject).toBe("CN=custom-cn");
	});
});
