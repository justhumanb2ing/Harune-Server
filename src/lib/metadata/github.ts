import { HTTPException } from "hono/http-exception";

import type {
	GithubContributionDay,
	GithubContributionMetadata,
	NormalizedMetadata,
} from "../../types/metadata";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const GITHUB_FAVICON = "https://github.githubassets.com/favicons/favicon.svg";
const GITHUB_PROFILE_HOSTS = new Set(["github.com", "www.github.com"]);
const GITHUB_RESERVED_SEGMENTS = new Set([
	"about",
	"apps",
	"collections",
	"contact",
	"customer-stories",
	"enterprise",
	"events",
	"explore",
	"features",
	"github-copilot",
	"github-enterprise",
	"join",
	"login",
	"marketplace",
	"orgs",
	"pricing",
	"private",
	"security",
	"sessions",
	"sponsors",
	"support",
	"topics",
	"trending",
	"users",
]);

type GithubGraphQLResponse = {
	data?: {
		user?: {
			login: string;
			name: string | null;
			avatarUrl: string;
			url: string;
			contributionsCollection: {
				contributionCalendar: {
					weeks: Array<{
						contributionDays: Array<{
							date: string;
							contributionCount: number;
							contributionLevel: string;
							color: string;
							weekday: number;
						}>;
					}>;
				};
			};
		} | null;
	};
	errors?: Array<{
		message: string;
		type?: string;
	}>;
};

export function isGithubProfileUrl(url: URL): boolean {
	return extractGithubLogin(url) !== null;
}

export function extractGithubLogin(url: URL): string | null {
	if (!GITHUB_PROFILE_HOSTS.has(url.hostname.toLowerCase())) {
		return null;
	}

	const segments = url.pathname.split("/").filter(Boolean);

	if (segments.length !== 1) {
		return null;
	}

	const login = segments[0]?.trim();

	if (!login || GITHUB_RESERVED_SEGMENTS.has(login.toLowerCase())) {
		return null;
	}

	return login;
}

export async function fetchGithubMetadata(
	inputUrl: URL,
	options: {
		token?: string | null;
		now?: Date;
	},
): Promise<NormalizedMetadata> {
	const login = extractGithubLogin(inputUrl);

	if (!login) {
		throw new HTTPException(400, {
			message: "url is not a GitHub profile URL",
			cause: { error: "invalid_url" },
		});
	}

	if (!options.token) {
		throw new HTTPException(502, {
			message: "github metadata requires GITHUB_TOKEN",
			cause: { error: "fetch_failed" },
		});
	}

	const now = options.now ?? new Date();
	const rangeEnd = now;
	const rangeStart = new Date(now);
	rangeStart.setUTCDate(rangeStart.getUTCDate() - 59);
	const rangeStartDate = rangeStart.toISOString().slice(0, 10);
	const rangeEndDate = rangeEnd.toISOString().slice(0, 10);

	const response = await fetch(GITHUB_GRAPHQL_ENDPOINT, {
		method: "POST",
		headers: {
			accept: "application/vnd.github+json",
			authorization: `Bearer ${options.token}`,
			"content-type": "application/json",
			"user-agent": "Harune API",
			"x-github-api-version": "2022-11-28",
		},
		body: JSON.stringify({
			query: `
        query GitHubContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $login) {
            login
            name
            avatarUrl(size: 320)
            url
            contributionsCollection(from: $from, to: $to) {
              contributionCalendar {
                weeks {
                  contributionDays {
                    date
                    contributionCount
                    contributionLevel
                    color
                    weekday
                  }
                }
              }
            }
          }
        }
      `,
			variables: {
				login,
				from: rangeStart.toISOString(),
				to: rangeEnd.toISOString(),
			},
		}),
	});

	if (!response.ok) {
		throw new HTTPException(502, {
			message: "failed to fetch github contributions",
			cause: { error: "fetch_failed", status: response.status },
		});
	}

	const body = (await response.json()) as GithubGraphQLResponse;

	if (!body.data?.user) {
		const message = body.errors?.[0]?.message ?? "github profile not found";
		const status = message.toLowerCase().includes("not found") ? 404 : 502;

		throw new HTTPException(status, {
			message,
			cause: {
				error: status === 404 ? "not_found" : "fetch_failed",
			},
		});
	}

	const user = body.data.user;
	const days = flattenContributionDays(
		user.contributionsCollection.contributionCalendar.weeks,
		rangeStartDate,
		rangeEndDate,
	);
	const totalContributions = days.reduce(
		(total, day) => total + day.contributionCount,
		0,
	);
	const profileUrl = user.url || `https://github.com/${user.login}`;
	const fetchedAt = now.toISOString();
	const metadata: GithubContributionMetadata = {
		provider: "github",
		viewType: "github_contributions_60d",
		fetchedAt,
		payload: {
			login: user.login,
			name: user.name,
			avatarUrl: user.avatarUrl ?? null,
			profileUrl,
			rangeStart: rangeStartDate,
			rangeEnd: rangeEndDate,
			totalContributions,
			days,
		},
	};

	return {
		url: profileUrl,
		canonicalUrl: profileUrl,
		title: user.name ?? user.login,
		description: null,
		image: user.avatarUrl ?? null,
		siteName: "GitHub",
		favicon: GITHUB_FAVICON,
		provider: "github",
		providerMetadata: metadata,
	};
}

type GithubContributionWeek = {
	contributionDays: GithubContributionDay[];
};

function flattenContributionDays(
	weeks: GithubContributionWeek[],
	rangeStart: string,
	rangeEnd: string,
): GithubContributionDay[] {
	const days = weeks.flatMap((week) => week.contributionDays);

	return days
		.filter((day) => {
			return day.date >= rangeStart && day.date <= rangeEnd;
		})
		.map((day) => ({
			date: day.date,
			contributionCount: day.contributionCount,
			contributionLevel: day.contributionLevel,
			color: day.color,
			weekday: day.weekday,
		}));
}
