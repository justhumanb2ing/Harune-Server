import { afterEach, describe, expect, it, vi } from "vitest";

import {
	extractGithubLogin,
	fetchGithubMetadata,
	isGithubProfileUrl,
} from "../github";

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

	it("builds a 60 day contribution metadata payload from GitHub GraphQL", async () => {
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

		vi.spyOn(globalThis, "fetch").mockResolvedValue(
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
			},
		);

		expect(metadata.provider).toBe("github");
		expect(metadata.domain).toBe("github.com");
		expect(metadata.title).toBe("The Octocat");
		expect(metadata.image).toBe(
			"https://avatars.githubusercontent.com/u/583231?v=4",
		);
		expect(metadata.providerMetadata).toEqual({
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
		});
		expect(metadata.favicon).toBe(
			"https://cdn.harune.me/public/assets/link-provider-icon/github.svg",
		);
	});
});
