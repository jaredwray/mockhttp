import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";

export type CertificateOptions = {
	/**
	 * Common Name for the certificate subject. Defaults to 'localhost'.
	 */
	commonName?: string;
	/**
	 * Subject Alternative Names. Defaults to [dns:localhost, ip:127.0.0.1, ip:::1].
	 */
	altNames?: Array<
		{ type: "dns"; value: string } | { type: "ip"; value: string }
	>;
	/**
	 * Number of days the certificate is valid. Defaults to 365.
	 */
	validityDays?: number;
	/**
	 * RSA key size in bits. Defaults to 2048.
	 */
	keySize?: number;
};

export type CertificateResult = {
	/**
	 * PEM-encoded X.509 certificate.
	 */
	cert: string;
	/**
	 * PEM-encoded PKCS#8 private key.
	 */
	key: string;
};

export type CertificateFileOptions = CertificateOptions & {
	/**
	 * File path to write the certificate PEM.
	 */
	certPath: string;
	/**
	 * File path to write the private key PEM.
	 */
	keyPath: string;
};

// --- ASN.1 DER encoding helpers ---

function encodeLength(length: number): Buffer {
	if (length < 0x80) {
		return Buffer.from([length]);
	}

	const bytes: number[] = [];
	let temp = length;
	while (temp > 0) {
		bytes.unshift(temp & 0xff);
		temp >>= 8;
	}

	return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function encodeTlv(tag: number, value: Buffer): Buffer {
	return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function encodeSequence(...elements: Buffer[]): Buffer {
	const content = Buffer.concat(elements);
	return encodeTlv(0x30, content);
}

function encodeSet(...elements: Buffer[]): Buffer {
	const content = Buffer.concat(elements);
	return encodeTlv(0x31, content);
}

function encodeInteger(value: Buffer | number): Buffer {
	let buf: Buffer;
	if (typeof value === "number") {
		if (value === 0) {
			buf = Buffer.from([0]);
		} else {
			const bytes: number[] = [];
			let temp = value;
			while (temp > 0) {
				bytes.unshift(temp & 0xff);
				temp >>= 8;
			}

			// Add leading zero if high bit is set (to keep it positive)
			if (bytes[0] & 0x80) {
				bytes.unshift(0);
			}

			buf = Buffer.from(bytes);
		}
	} else {
		// Ensure positive representation
		if (value.length > 0 && value[0] & 0x80) {
			buf = Buffer.concat([Buffer.from([0]), value]);
		} else {
			buf = value;
		}
	}

	return encodeTlv(0x02, buf);
}

function encodeBitString(value: Buffer): Buffer {
	// Prepend unused-bits byte (0)
	const content = Buffer.concat([Buffer.from([0]), value]);
	return encodeTlv(0x03, content);
}

function encodeOctetString(value: Buffer): Buffer {
	return encodeTlv(0x04, value);
}

function encodeOid(oid: number[]): Buffer {
	const bytes: number[] = [];
	// First two components are encoded as 40 * first + second
	bytes.push(40 * oid[0] + oid[1]);

	for (let i = 2; i < oid.length; i++) {
		let component = oid[i];
		if (component < 128) {
			bytes.push(component);
		} else {
			const encoded: number[] = [];
			encoded.push(component & 0x7f);
			component >>= 7;
			while (component > 0) {
				encoded.push((component & 0x7f) | 0x80);
				component >>= 7;
			}

			encoded.reverse();
			bytes.push(...encoded);
		}
	}

	return encodeTlv(0x06, Buffer.from(bytes));
}

function encodeUtf8String(value: string): Buffer {
	return encodeTlv(0x0c, Buffer.from(value, "utf8"));
}

function encodePrintableString(value: string): Buffer {
	return encodeTlv(0x13, Buffer.from(value, "ascii"));
}

function encodeUtcTime(date: Date): Buffer {
	const year = date.getUTCFullYear() % 100;
	const str = `${pad2(year)}${pad2(date.getUTCMonth() + 1)}${pad2(date.getUTCDate())}${pad2(date.getUTCHours())}${pad2(date.getUTCMinutes())}${pad2(date.getUTCSeconds())}Z`;
	return encodeTlv(0x17, Buffer.from(str, "ascii"));
}

function encodeContextSpecific(tag: number, value: Buffer): Buffer {
	return encodeTlv(0xa0 | tag, value);
}

function pad2(n: number): string {
	return n.toString().padStart(2, "0");
}

// --- OID constants ---

// 1.2.840.113549.1.1.11 = sha256WithRSAEncryption
const OID_SHA256_WITH_RSA = [1, 2, 840, 113549, 1, 1, 11];
// 2.5.4.3 = commonName
const OID_COMMON_NAME = [2, 5, 4, 3];
// 2.5.29.17 = subjectAltName
const OID_SUBJECT_ALT_NAME = [2, 5, 29, 17];

// --- X.509 certificate builder ---

function buildAlgorithmIdentifier(): Buffer {
	return encodeSequence(encodeOid(OID_SHA256_WITH_RSA), encodeTlv(0x05, Buffer.alloc(0))); // NULL
}

function buildName(cn: string): Buffer {
	const rdn = encodeSet(
		encodeSequence(encodeOid(OID_COMMON_NAME), encodeUtf8String(cn)),
	);
	return encodeSequence(rdn);
}

function buildValidity(notBefore: Date, notAfter: Date): Buffer {
	return encodeSequence(encodeUtcTime(notBefore), encodeUtcTime(notAfter));
}

function encodeIpAddress(ip: string): Buffer {
	// Handle IPv4
	if (ip.includes(".")) {
		const parts = ip.split(".").map(Number);
		return Buffer.from(parts);
	}

	// Handle IPv6
	const expanded = expandIpv6(ip);
	const buf = Buffer.alloc(16);
	const groups = expanded.split(":");
	for (let i = 0; i < 8; i++) {
		const val = Number.parseInt(groups[i], 16);
		buf.writeUInt16BE(val, i * 2);
	}

	return buf;
}

function expandIpv6(ip: string): string {
	// Handle :: expansion
	if (ip.includes("::")) {
		const [left, right] = ip.split("::");
		const leftGroups = left ? left.split(":") : [];
		const rightGroups = right ? right.split(":") : [];
		const missing = 8 - leftGroups.length - rightGroups.length;
		const middle = Array.from({ length: missing }).fill("0000") as string[];
		const allGroups = [...leftGroups, ...middle, ...rightGroups];
		return allGroups.map((g) => g.padStart(4, "0")).join(":");
	}

	return ip
		.split(":")
		.map((g) => g.padStart(4, "0"))
		.join(":");
}

function buildSubjectAltNameExtension(
	altNames: Array<
		{ type: "dns"; value: string } | { type: "ip"; value: string }
	>,
): Buffer {
	const names: Buffer[] = [];
	for (const alt of altNames) {
		if (alt.type === "dns") {
			// Context-specific tag [2] for dNSName (IA5String implicit)
			names.push(encodeTlv(0x82, Buffer.from(alt.value, "ascii")));
		} else {
			// Context-specific tag [7] for iPAddress
			names.push(encodeTlv(0x87, encodeIpAddress(alt.value)));
		}
	}

	const sanValue = encodeSequence(...names);

	// Extension: OID, critical=false (omitted), extnValue as OCTET STRING
	return encodeSequence(
		encodeOid(OID_SUBJECT_ALT_NAME),
		encodeOctetString(sanValue),
	);
}

function buildExtensions(
	altNames: Array<
		{ type: "dns"; value: string } | { type: "ip"; value: string }
	>,
): Buffer {
	const extensions = encodeSequence(buildSubjectAltNameExtension(altNames));
	// Extensions are context-specific [3] EXPLICIT
	return encodeContextSpecific(3, extensions);
}

function buildTbsCertificate(
	serialNumber: Buffer,
	issuerCn: string,
	notBefore: Date,
	notAfter: Date,
	subjectCn: string,
	publicKeyDer: Buffer,
	altNames: Array<
		{ type: "dns"; value: string } | { type: "ip"; value: string }
	>,
): Buffer {
	const version = encodeContextSpecific(0, encodeInteger(2)); // v3
	const serial = encodeInteger(serialNumber);
	const signatureAlgorithm = buildAlgorithmIdentifier();
	const issuer = buildName(issuerCn);
	const validity = buildValidity(notBefore, notAfter);
	const subject = buildName(subjectCn);
	const extensions = buildExtensions(altNames);

	return encodeSequence(
		version,
		serial,
		signatureAlgorithm,
		issuer,
		validity,
		subject,
		publicKeyDer, // SubjectPublicKeyInfo (already DER-encoded from crypto)
		extensions,
	);
}

function derToPem(der: Buffer, label: string): string {
	const base64 = der.toString("base64");
	const lines: string[] = [];
	for (let i = 0; i < base64.length; i += 64) {
		lines.push(base64.slice(i, i + 64));
	}

	return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----\n`;
}

// --- Public API ---

/**
 * Generate a self-signed certificate using only Node.js built-in crypto.
 * Returns PEM-encoded certificate and private key strings.
 */
export function generateCertificate(options?: CertificateOptions): CertificateResult {
	const commonName = options?.commonName ?? "localhost";
	const validityDays = options?.validityDays ?? 365;
	const keySize = options?.keySize ?? 2048;
	const altNames = options?.altNames ?? [
		{ type: "dns" as const, value: "localhost" },
		{ type: "ip" as const, value: "127.0.0.1" },
		{ type: "ip" as const, value: "::1" },
	];

	// Generate RSA key pair
	const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
		modulusLength: keySize,
		publicKeyEncoding: { type: "spki", format: "der" },
		privateKeyEncoding: { type: "pkcs8", format: "pem" },
	});

	// Build dates
	const notBefore = new Date();
	const notAfter = new Date();
	notAfter.setDate(notAfter.getDate() + validityDays);

	// Generate random serial number (16 bytes, positive)
	const serialNumber = crypto.randomBytes(16);
	// Ensure positive by clearing the high bit
	serialNumber[0] &= 0x7f;

	// Build TBS certificate
	const publicKeyDer = publicKey as unknown as Buffer;
	const tbsCertificate = buildTbsCertificate(
		serialNumber,
		commonName,
		notBefore,
		notAfter,
		commonName,
		publicKeyDer,
		altNames,
	);

	// Sign the TBS certificate
	const signer = crypto.createSign("SHA256");
	signer.update(tbsCertificate);
	const signature = signer.sign(privateKey as unknown as string);

	// Build the full certificate
	const certificate = encodeSequence(
		tbsCertificate,
		buildAlgorithmIdentifier(),
		encodeBitString(signature),
	);

	return {
		cert: derToPem(certificate, "CERTIFICATE"),
		key: privateKey as unknown as string,
	};
}

/**
 * Generate a self-signed certificate and write PEM files to disk.
 * Returns the same CertificateResult as generateCertificate().
 */
export async function generateCertificateFiles(
	options: CertificateFileOptions,
): Promise<CertificateResult> {
	const result = generateCertificate(options);
	await fsPromises.writeFile(options.certPath, result.cert, "utf8");
	await fsPromises.writeFile(options.keyPath, result.key, "utf8");
	return result;
}
