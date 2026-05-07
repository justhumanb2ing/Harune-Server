import { HTTPException } from "hono/http-exception";

import type { Database } from "../lib/db";
import { findMeRowByUserId, type MeRow } from "../repositories/me-repository";
import type { MeResponse } from "../types/me";

type MeDependencies = {
	findMeRowByUserId?: (db: Database, userId: string) => Promise<MeRow | null>;
};

export async function getMe(
	db: Database,
	userId: string,
	dependencies: MeDependencies = {},
): Promise<MeResponse> {
	const findMeRow = dependencies.findMeRowByUserId ?? findMeRowByUserId;
	const row = await findMeRow(db, userId);

	if (!row) {
		throw new HTTPException(404, {
			message: "me not found",
			cause: { error: "me_not_found" },
		});
	}

	return buildMeResponse(row);
}

function buildMeResponse(row: MeRow): MeResponse {
	return {
		currentPlan: buildCurrentPlan(row),
		profilePage: buildProfilePage(row),
		user: {
			id: requireValue(
				row.userId,
				"me_data_missing",
				"me data is internally inconsistent",
			),
			email: requireValue(
				row.userEmail,
				"me_data_missing",
				"me data is internally inconsistent",
			),
			name: row.userName ?? null,
			image: row.userImage ?? null,
			createdAt: requireDate(
				row.userCreatedAt,
				"me_data_missing",
				"me data is internally inconsistent",
			),
			updatedAt: requireDate(
				row.userUpdatedAt,
				"me_data_missing",
				"me data is internally inconsistent",
			),
			planId: row.userPlanId ?? null,
			credits: normalizeCredits(row.userCredits),
		},
	};
}

function buildCurrentPlan(row: MeRow): MeResponse["currentPlan"] {
	if (!row.planId) {
		return null;
	}

	return {
		id: requireValue(
			row.planId,
			"me_data_missing",
			"me data is internally inconsistent",
		),
		name: requireValue(
			row.planName,
			"me_data_missing",
			"me data is internally inconsistent",
		),
		codename: requireValue(
			row.planCodename,
			"me_data_missing",
			"me data is internally inconsistent",
		),
		quotas: row.planQuotas,
		default: requireValue(
			row.planDefault,
			"me_data_missing",
			"me data is internally inconsistent",
		),
	};
}

function buildProfilePage(row: MeRow): MeResponse["profilePage"] {
	if (!row.profilePageId) {
		return null;
	}

	return {
		id: requireValue(
			row.profilePageId,
			"me_data_missing",
			"me data is internally inconsistent",
		),
		handle: requireValue(
			row.profilePageHandle,
			"me_data_missing",
			"me data is internally inconsistent",
		),
		name: row.profilePageName ?? null,
		image: row.profilePageImage ?? null,
	};
}

function normalizeCredits(value: unknown): Record<string, number> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const entries = Object.entries(value as Record<string, unknown>).filter(
		([, entry]) => typeof entry === "number" && Number.isFinite(entry),
	) as Array<[string, number]>;

	return Object.fromEntries(entries);
}

function requireValue<T>(
	value: T | null | undefined,
	code: string,
	message: string,
): T {
	if (value === null || value === undefined) {
		throw new HTTPException(500, {
			message,
			cause: { error: code },
		});
	}

	return value;
}

function requireDate(
	value: Date | null | undefined,
	code: string,
	message: string,
): string {
	const date = requireValue(value, code, message);

	return date.toISOString();
}
