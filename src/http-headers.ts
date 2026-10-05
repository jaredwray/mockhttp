export function firstHeader(
	value: string | string[] | undefined,
): string | undefined {
	const raw = Array.isArray(value) ? value[0] : value;
	if (typeof raw !== "string") {
		return undefined;
	}

	const token = raw.split(",")[0].trim();
	return token.length > 0 ? token : undefined;
}
