import { describe, expect, it } from "vitest";

import {
	profileBentoLayouts,
	profileBentos,
	profileLinkBentos,
	profileMapBentos,
	profileMediaBentos,
	profilePages,
	profileSectionBentos,
	profileTextBentos,
} from "../../schemas/profile";
import { syncProfileBentoGraph } from "../profile-repository";

type Operation =
	| { kind: "delete"; table: string }
	| { kind: "insert"; table: string; values: unknown };

function createRows() {
	return [
		{
			pageId: "page-1",
			pageUserId: "user-1",
			pageHandle: "maker",
			pageName: "Maker",
			pageRole: null,
			pageBio: null,
			pageImage: null,
			pageBackgroundImage: null,
			pageLocation: null,
			pageUpdatedAt: new Date("2026-05-08T00:00:00.000Z"),
			bentoId: "bento-1",
			bentoType: "media",
			desktopLayoutId: "layout-1",
			desktopLayoutBreakdown: "desktop",
			desktopLayoutX: 0,
			desktopLayoutY: 0,
			desktopLayoutW: 1,
			desktopLayoutH: 2,
			compactLayoutId: "layout-2",
			compactLayoutBreakdown: "compact",
			compactLayoutX: 0,
			compactLayoutY: 0,
			compactLayoutW: 1,
			compactLayoutH: 2,
			linkBentoId: null,
			linkTitle: null,
			linkDescription: null,
			linkFavicon: null,
			linkThumbnail: null,
			linkUrl: null,
			textBentoId: null,
			textContent: null,
			sectionBentoId: null,
			sectionTitle: null,
			mediaBentoId: "media-row-1",
			mediaType: "image",
			mediaUrl:
				"https://cdn.harune.me/public/users/user-1/profile/bento/bento-1/media?v=old",
			mediaObjectKey: "public/users/user-1/profile/bento/bento-1/media",
			mediaHref: null,
			mediaAlt: "Old alt",
			mediaCaption: "Old caption",
			mapBentoId: null,
			mapLatitude: null,
			mapLongitude: null,
			mapZoom: null,
			mapCaption: null,
			mapUrl: null,
		},
		{
			pageId: "page-1",
			pageUserId: "user-1",
			pageHandle: "maker",
			pageName: "Maker",
			pageRole: null,
			pageBio: null,
			pageImage: null,
			pageBackgroundImage: null,
			pageLocation: null,
			pageUpdatedAt: new Date("2026-05-08T00:00:00.000Z"),
			bentoId: "bento-2",
			bentoType: "text",
			desktopLayoutId: "layout-3",
			desktopLayoutBreakdown: "desktop",
			desktopLayoutX: 0,
			desktopLayoutY: 2,
			desktopLayoutW: 2,
			desktopLayoutH: 1,
			compactLayoutId: "layout-4",
			compactLayoutBreakdown: "compact",
			compactLayoutX: 0,
			compactLayoutY: 2,
			compactLayoutW: 2,
			compactLayoutH: 1,
			linkBentoId: null,
			linkTitle: null,
			linkDescription: null,
			linkFavicon: null,
			linkThumbnail: null,
			linkUrl: null,
			textBentoId: "text-row-1",
			textContent: "Keep me",
			sectionBentoId: null,
			sectionTitle: null,
			mediaBentoId: null,
			mediaType: null,
			mediaUrl: null,
			mediaObjectKey: null,
			mediaHref: null,
			mediaAlt: null,
			mediaCaption: null,
			mapBentoId: null,
			mapLatitude: null,
			mapLongitude: null,
			mapZoom: null,
			mapCaption: null,
			mapUrl: null,
		},
	] as const;
}

function createMockDb(rows: readonly unknown[]) {
	const operations: Operation[] = [];

	const selectChain = {
		leftJoin: () => selectChain,
		where: () => selectChain,
		orderBy: async () => rows,
	};

	const tx = {
		select: () => ({
			from: () => selectChain,
		}),
		delete: (table: unknown) => ({
			where: async () => {
				operations.push({ kind: "delete", table: tableName(table) });
			},
		}),
		insert: (table: unknown) => ({
			values: (_values: unknown) => ({
				onConflictDoUpdate: async () => {
					operations.push({
						kind: "insert",
						table: tableName(table),
						values: _values,
					});
				},
			}),
		}),
	};

	const db = {
		transaction: async (callback: (tx: typeof tx) => Promise<void>) => {
			await callback(tx);
		},
	};

	return { db, operations };
}

function tableName(table: unknown) {
	switch (table) {
		case profileBentos:
			return "profile_bento";
		case profileBentoLayouts:
			return "profile_bento_layout";
		case profileLinkBentos:
			return "profile_link_bento";
		case profileTextBentos:
			return "profile_text_bento";
		case profileSectionBentos:
			return "profile_section_bento";
		case profileMediaBentos:
			return "profile_media_bento";
		case profileMapBentos:
			return "profile_map_bento";
		case profilePages:
			return "profile_page";
		default:
			return "unknown";
	}
}

function getInsertValues(operations: Operation[], table: string) {
	const operation = operations.find(
		(entry): entry is Extract<Operation, { kind: "insert" }> =>
			entry.kind === "insert" && entry.table === table,
	);

	return operation?.values;
}

describe("syncProfileBentoGraph", () => {
	it("removes the old subtype row when a bento changes type", async () => {
		const { db, operations } = createMockDb(createRows());

		await syncProfileBentoGraph(db as never, "page-1", [
			{
				id: "bento-1",
				type: "text",
				layout: {
					desktop: { x: 0, y: 0, w: 1, h: 2 },
					compact: { x: 0, y: 0, w: 1, h: 2 },
				},
				content: {
					content: "New text 1",
				},
			},
		]);

		expect(
			operations.map((operation) => `${operation.kind}:${operation.table}`),
		).toEqual([
			"delete:profile_link_bento",
			"delete:profile_text_bento",
			"delete:profile_section_bento",
			"delete:profile_media_bento",
			"delete:profile_map_bento",
			"delete:profile_bento",
			"delete:profile_bento",
			"insert:profile_bento",
			"insert:profile_bento_layout",
			"insert:profile_text_bento",
		]);
	});

	it("removes the deleted media bento and its subtype row when only text remains", async () => {
		const { db, operations } = createMockDb(createRows());

		await syncProfileBentoGraph(db as never, "page-1", [
			{
				id: "bento-2",
				type: "text",
				layout: {
					desktop: { x: 0, y: 2, w: 2, h: 1 },
					compact: { x: 0, y: 2, w: 2, h: 1 },
				},
				content: {
					content: "Keep me",
				},
			},
		]);

		expect(
			operations.map((operation) => `${operation.kind}:${operation.table}`),
		).toEqual([
			"delete:profile_link_bento",
			"delete:profile_text_bento",
			"delete:profile_section_bento",
			"delete:profile_media_bento",
			"delete:profile_map_bento",
			"delete:profile_bento",
		]);
	});

	it("maps public snapshot ids back to canonical ids before updating an existing bento", async () => {
		const { db, operations } = createMockDb(createRows());

		await syncProfileBentoGraph(db as never, "page-1", [
			{
				id: "media-row-1",
				type: "media",
				layout: {
					desktop: { x: 0, y: 0, w: 1, h: 2 },
					compact: { x: 0, y: 0, w: 1, h: 2 },
				},
				content: {
					mediaType: "image",
					url: "https://cdn.harune.me/public/users/user-1/profile/bento/bento-1/media?v=old",
					objectKey: "public/users/user-1/profile/bento/bento-1/media",
					href: null,
					alt: "Old alt",
					caption: "Old caption",
				},
			},
			{
				id: "text-row-1",
				type: "text",
				layout: {
					desktop: { x: 0, y: 2, w: 2, h: 1 },
					compact: { x: 0, y: 2, w: 2, h: 1 },
				},
				content: {
					content: "Updated text",
				},
			},
		]);

		expect(
			operations.map((operation) => `${operation.kind}:${operation.table}`),
		).toEqual([
			"insert:profile_bento",
			"insert:profile_bento_layout",
			"insert:profile_text_bento",
		]);

		expect(getInsertValues(operations, "profile_bento")).toEqual([
			{
				id: "bento-2",
				profilePageId: "page-1",
				type: "text",
				updatedAt: expect.any(Date),
			},
		]);
	});

	it("maps public snapshot ids back to canonical ids before deleting an existing bento", async () => {
		const { db, operations } = createMockDb(createRows());

		await syncProfileBentoGraph(db as never, "page-1", [
			{
				id: "text-row-1",
				type: "text",
				layout: {
					desktop: { x: 0, y: 2, w: 2, h: 1 },
					compact: { x: 0, y: 2, w: 2, h: 1 },
				},
				content: {
					content: "Keep me",
				},
			},
		]);

		expect(
			operations.map((operation) => `${operation.kind}:${operation.table}`),
		).toEqual([
			"delete:profile_link_bento",
			"delete:profile_text_bento",
			"delete:profile_section_bento",
			"delete:profile_media_bento",
			"delete:profile_map_bento",
			"delete:profile_bento",
		]);

		expect(getInsertValues(operations, "profile_bento")).toBeUndefined();
	});

	it("persists link bento metadata alongside the link content", async () => {
		const { db, operations } = createMockDb([]);

		await syncProfileBentoGraph(db as never, "page-1", [
			{
				id: "link-bento-1",
				type: "link",
				layout: {
					desktop: { x: 0, y: 0, w: 2, h: 1 },
					compact: { x: 0, y: 0, w: 2, h: 1 },
				},
				content: {
					title: "GitHub",
					description: "GitHub profile",
					favicon: "https://github.githubassets.com/favicons/favicon.svg",
					thumbnail: null,
					url: "https://github.com/octocat",
					metadata: {
						provider: "github",
						viewType: "github_contributions_60d",
						fetchedAt: "2026-05-12T00:00:00.000Z",
						domain: "github.com",
						payload: {
							login: "octocat",
						},
					},
				},
			},
		]);

		expect(
			operations.map((operation) => `${operation.kind}:${operation.table}`),
		).toEqual([
			"insert:profile_bento",
			"insert:profile_bento_layout",
			"insert:profile_link_bento",
		]);

		expect(getInsertValues(operations, "profile_link_bento")).toEqual([
			{
				bentoId: "link-bento-1",
				title: "GitHub",
				description: "GitHub profile",
				favicon: "https://github.githubassets.com/favicons/favicon.svg",
				thumbnail: null,
				url: "https://github.com/octocat",
				metadata: {
					provider: "github",
					viewType: "github_contributions_60d",
					fetchedAt: "2026-05-12T00:00:00.000Z",
					domain: "github.com",
					payload: {
						login: "octocat",
					},
				},
			},
		]);
	});
});
