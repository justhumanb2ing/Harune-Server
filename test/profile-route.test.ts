import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

import { handleHonoError } from "../src/lib/error-utils";
import * as profileRepository from "../src/repositories/profile-repository";
import profileRoute from "../src/routes/profile-route";
import type { AppBindings } from "../src/types/app-bindings";

function createApp(session: { userId: string } | null) {
	const app = new Hono<AppBindings>();

	app.use("*", async (c, next) => {
		c.set("db", {} as never);
		c.set("session", session as never);
		await next();
	});
	app.onError(handleHonoError);
	app.route("/profile", profileRoute);

	return app;
}

describe("GET /profile/:handle", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns the public profile response with supported bentos only", async () => {
		vi.spyOn(profileRepository, "findProfileRowsByHandle").mockResolvedValue([
			{
				pageId: "page-1",
				pageUserId: "user-1",
				pageHandle: "maker",
				pageName: "Maker",
				pageRole: "creator",
				pageBio: "Bio",
				pageImage: "https://example.com/avatar.png",
				pageImageCrop: null,
				pageBackgroundImage: null,
				pageLocation: "Seoul",
				pageUpdatedAt: new Date("2026-05-07T00:00:00.000Z"),
				bentoId: "bento-1",
				bentoType: "link",
				desktopLayoutId: "desktop-layout-1",
				desktopLayoutX: 1,
				desktopLayoutY: 2,
				desktopLayoutW: 3,
				desktopLayoutH: 4,
				compactLayoutId: "compact-layout-1",
				compactLayoutX: 5,
				compactLayoutY: 6,
				compactLayoutW: 7,
				compactLayoutH: 8,
				linkBentoId: "link-bento-1",
				linkTitle: "Link title",
				linkDescription: null,
				linkFavicon: null,
				linkThumbnail: null,
				linkUrl: "https://example.com",
				textBentoId: null,
				textContent: null,
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
		]);

		const app = createApp({ userId: "user-1" });
		const response = await app.request("/profile/maker");
		const json = await response.json();

		expect(response.status).toBe(200);
		expect(json).toEqual({
			page: {
				id: "page-1",
				userId: "user-1",
				handle: "maker",
				name: "Maker",
				role: "creator",
				bio: "Bio",
				image: "https://example.com/avatar.png",
				imageCrop: null,
				backgroundImage: null,
				location: "Seoul",
				updatedAt: "2026-05-07T00:00:00.000Z",
			},
			bento: [
				{
					id: "link-bento-1",
					type: "link",
					layout: {
						desktop: { x: 1, y: 2, w: 3, h: 4 },
						compact: { x: 5, y: 6, w: 7, h: 8 },
					},
					content: {
						title: "Link title",
						description: null,
						favicon: null,
						thumbnail: null,
						url: "https://example.com",
					},
				},
			],
			viewer: {
				isAuthenticated: true,
				userId: "user-1",
				canEdit: true,
			},
		});
		expect(json.bento).toHaveLength(1);
		expect(json.bento[0]?.type).toBe("link");
	});
});
