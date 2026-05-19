const PROVIDER_ICON_BASE_URL =
	"https://cdn.harune.me/public/assets/link-provider-icon";

const PROVIDER_ICON_HOSTS = [
	{ icon: "behance.svg", hosts: ["behance.net"] },
	{ icon: "buymeacoffee.svg", hosts: ["buymeacoffee.com"] },
	{ icon: "chzzk.svg", hosts: ["chzzk.naver.com"] },
	{ icon: "dribbble.svg", hosts: ["dribbble.com"] },
	{ icon: "figma.svg", hosts: ["figma.com"] },
	{ icon: "github.svg", hosts: ["github.com"] },
	{ icon: "gumroad.svg", hosts: ["gumroad.com"] },
	{ icon: "facebook.svg", hosts: ["facebook.com"] },
	{ icon: "discord.svg", hosts: ["discord.com", "discord.gg"] },
	{ icon: "instagram.svg", hosts: ["instagram.com"] },
	{ icon: "kofi.svg", hosts: ["ko-fi.com", "kofi.com"] },
	{ icon: "linkedin.svg", hosts: ["linkedin.com"] },
	{ icon: "medium.svg", hosts: ["medium.com"] },
	{ icon: "patreon.svg", hosts: ["patreon.com"] },
	{ icon: "producthunt.svg", hosts: ["producthunt.com"] },
	{ icon: "reddit.svg", hosts: ["reddit.com"] },
	{ icon: "spotify.svg", hosts: ["spotify.com"] },
	{ icon: "threads.svg", hosts: ["threads.com", "threads.net"] },
	{ icon: "tiktok.svg", hosts: ["tiktok.com"] },
	{ icon: "twitch.svg", hosts: ["twitch.tv"] },
	{ icon: "x.svg", hosts: ["x.com", "twitter.com"] },
	{ icon: "substack.svg", hosts: ["substack.com"] },
	{ icon: "youtube.svg", hosts: ["youtube.com"] },
] as const;

export function resolveProviderFaviconUrl(
	pageUrl: string | URL,
): string | null {
	const url = typeof pageUrl === "string" ? new URL(pageUrl) : pageUrl;
	const hostname = url.hostname.toLowerCase();

	for (const provider of PROVIDER_ICON_HOSTS) {
		if (provider.hosts.some((host) => matchesHostname(hostname, host))) {
			return `${PROVIDER_ICON_BASE_URL}/${provider.icon}`;
		}
	}

	return null;
}

function matchesHostname(hostname: string, candidate: string): boolean {
	return hostname === candidate || hostname.endsWith(`.${candidate}`);
}
