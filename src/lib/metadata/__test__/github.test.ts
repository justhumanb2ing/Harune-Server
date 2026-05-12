import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractGithubLogin,
	fetchGithubMetadata,
	isGithubProfileUrl,
} from "../github";
import { extractMetadata } from "../html";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("github metadata", () => {
	it("detects GitHub profile URLs and extracts the login", () => {
		expect(isGithubProfileUrl(new URL("https://github.com/octocat"))).toBe(
			true,
		);
		expect(extractGithubLogin(new URL("https://github.com/octocat/"))).toBe(
			"octocat",
		);
		expect(
			extractGithubLogin(
				new URL("https://github.com/octocat?tab=repositories"),
			),
		).toBe("octocat");
		expect(
			isGithubProfileUrl(new URL("https://github.com/octocat/harune")),
		).toBe(false);
		expect(
			extractGithubLogin(new URL("https://example.com/octocat")),
		).toBeNull();
	});

	it("preserves html base metadata and enriches it with github provider data", async () => {
		const now = new Date("2026-05-12T12:00:00.000Z");
		const githubDays = Array.from({ length: 60 }, (_, index) => {
			const day = new Date(now);
			day.setUTCDate(day.getUTCDate() - (59 - index));
			const date = day.toISOString().slice(0, 10);

			return {
				date,
				contributionCount: index % 5,
				contributionLevel: "FIRST_QUARTILE",
				color: "#39d353",
				weekday: (index + 1) % 7,
			};
		});
		const base = extractMetadata(
			`<!doctype html><html><head>
				<title>The Octocat</title>
				<meta name="description" content="GitHub profile for octocat">
				<meta property="og:image" content="https://example.com/base-avatar.png">
				<link rel="icon" href="/favicon.ico">
			</head><body></body></html>`,
			"https://github.com/octocat",
		);

		const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(
				JSON.stringify({
					data: {
						user: {
							login: "octocat",
							name: "The Octocat",
							avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
							url: "https://github.com/octocat",
							contributionsCollection: {
								contributionCalendar: {
									weeks: [
										{
											contributionDays: githubDays.slice(0, 7),
										},
										{
											contributionDays: githubDays.slice(7, 14),
										},
										{
											contributionDays: githubDays.slice(14, 21),
										},
										{
											contributionDays: githubDays.slice(21, 28),
										},
										{
											contributionDays: githubDays.slice(28),
										},
									],
								},
							},
						},
					},
				}),
				{
					status: 200,
					headers: {
						"content-type": "application/json",
					},
				},
			) as Response,
		);

		const metadata = await fetchGithubMetadata(
			new URL("https://github.com/octocat"),
			{
				token: "github-token",
				now,
				base,
			},
		);

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(metadata).toEqual({
			...base,
			canonicalUrl: "https://github.com/octocat",
			provider: "github",
			providerMetadata: {
				provider: "github",
				viewType: "github_contributions_60d",
				fetchedAt: "2026-05-12T12:00:00.000Z",
				payload: {
					login: "octocat",
					name: "The Octocat",
					avatarUrl: "https://avatars.githubusercontent.com/u/583231?v=4",
					profileUrl: "https://github.com/octocat",
					rangeStart: "2026-03-14",
					rangeEnd: "2026-05-12",
					totalContributions: githubDays.reduce(
						(total, day) => total + day.contributionCount,
						0,
					),
					days: githubDays,
				},
			},
		});
	});
});
