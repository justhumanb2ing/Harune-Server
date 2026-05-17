export type ProfileTextAlign = "start" | "center" | "end";

export type ProfileTextBentoStyle = {
	backgroundColor: string;
	textAlign: ProfileTextAlign;
};

const DEFAULT_PROFILE_TEXT_BENTO_STYLE: ProfileTextBentoStyle = {
	backgroundColor: "#ffffff",
	textAlign: "start",
};

const PROFILE_TEXT_BENTO_STYLE_KEYS = new Set(["backgroundColor", "textAlign"]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTrimmedString(value: unknown) {
	if (typeof value !== "string") {
		return null;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export function normalizeProfileTextAlign(
	value: unknown,
): ProfileTextAlign | null {
	if (value === "start" || value === "center" || value === "end") {
		return value;
	}

	if (value === "left") {
		return "start";
	}

	if (value === "right") {
		return "end";
	}

	return null;
}

export function resolveProfileTextBentoStyle(
	value: unknown,
): ProfileTextBentoStyle {
	if (!isRecord(value)) {
		return {
			...DEFAULT_PROFILE_TEXT_BENTO_STYLE,
		};
	}

	const backgroundColor =
		parseTrimmedString(value.backgroundColor) ??
		DEFAULT_PROFILE_TEXT_BENTO_STYLE.backgroundColor;
	const textAlign =
		normalizeProfileTextAlign(value.textAlign) ??
		DEFAULT_PROFILE_TEXT_BENTO_STYLE.textAlign;

	return {
		backgroundColor,
		textAlign,
	};
}

export function parseProfileTextBentoStyle(
	value: unknown,
): ProfileTextBentoStyle | null {
	if (value === undefined || value === null) {
		return {
			...DEFAULT_PROFILE_TEXT_BENTO_STYLE,
		};
	}

	if (!isRecord(value)) {
		return null;
	}

	for (const key of Object.keys(value)) {
		if (!PROFILE_TEXT_BENTO_STYLE_KEYS.has(key)) {
			return null;
		}
	}

	const backgroundColor =
		value.backgroundColor === undefined || value.backgroundColor === null
			? DEFAULT_PROFILE_TEXT_BENTO_STYLE.backgroundColor
			: parseTrimmedString(value.backgroundColor);

	if (!backgroundColor) {
		return null;
	}

	const textAlign =
		value.textAlign === undefined || value.textAlign === null
			? DEFAULT_PROFILE_TEXT_BENTO_STYLE.textAlign
			: normalizeProfileTextAlign(value.textAlign);

	if (!textAlign) {
		return null;
	}

	return {
		backgroundColor,
		textAlign,
	};
}

export { DEFAULT_PROFILE_TEXT_BENTO_STYLE };
