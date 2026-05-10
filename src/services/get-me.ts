import { HTTPException } from "hono/http-exception";

import type { Database } from "../lib/db";
import { updateUserSubscriptionStateById } from "../repositories/dodo-subscription-repository";
import { findMeRowByUserId, type MeRow } from "../repositories/me-repository";
import type { MeResponse } from "../types/me";

type MeDependencies = {
	findMeRowByUserId?: (db: Database, userId: string) => Promise<MeRow | null>;
	updateUserSubscriptionStateById?: typeof updateUserSubscriptionStateById;
	now?: () => Date;
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

	const reconciledRow = await reconcileExpiredSubscription(
		db,
		row,
		dependencies,
	);

	return buildMeResponse(reconciledRow);
}

async function reconcileExpiredSubscription(
	db: Database,
	row: MeRow,
	dependencies: MeDependencies,
): Promise<MeRow> {
	const now = dependencies.now?.() ?? new Date();
	const accessUntil = row.dodoSubscriptionAccessUntilAt;

	if (!accessUntil || accessUntil.getTime() > now.getTime()) {
		return row;
	}

	const updateUserSubscriptionState =
		dependencies.updateUserSubscriptionStateById ??
		updateUserSubscriptionStateById;

	try {
		await updateUserSubscriptionState(db, row.userId, {
			planId: row.userPlanId !== null ? null : undefined,
			dodoSubscriptionAccessUntilAt: null,
		});
	} catch (error) {
		console.warn(
			JSON.stringify({
				scope: "me_subscription_reconcile",
				stage: "cleanup_failed",
				userId: row.userId,
				error: error instanceof Error ? error.message : "unknown_error",
			}),
		);
	}

	return {
		...row,
		userPlanId: null,
		planId: null,
		planName: null,
		planCodename: null,
		planQuotas: null,
		planDefault: null,
		dodoSubscriptionAccessUntilAt: null,
	};
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
