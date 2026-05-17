import type { ProfileTextBentoStyle } from "../lib/profile-text-style";

export type ProfileImageCrop = {
	croppedAreaPixels: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
};

export type GetProfileRequest = {
	handle: string;
};

export type ProfileBentoLayouts = {
	desktop: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
	compact: {
		x: number;
		y: number;
		w: number;
		h: number;
	};
};

export type ProfileLinkBento = {
	id: string;
	type: "link";
	layout: ProfileBentoLayouts;
	content: {
		title: string;
		description: string | null;
		favicon: string | null;
		thumbnail: string | null;
		url: string;
		metadata: LinkBentoMetadata | null;
	};
};

export type LinkBentoMetadata = {
	provider: string;
	viewType: string;
	fetchedAt: string;
	domain: string | null;
	payload: Record<string, unknown>;
};

export type ProfileTextBento = {
	id: string;
	type: "text";
	layout: ProfileBentoLayouts;
	content: {
		content: string;
		style: ProfileTextBentoStyle;
	};
};

export type ProfileSectionBento = {
	id: string;
	type: "section";
	layout: ProfileBentoLayouts;
	content: {
		title: string;
	};
};

export type ProfileMediaBento = {
	id: string;
	type: "media";
	layout: ProfileBentoLayouts;
	content: {
		mediaType: "image" | "video";
		url: string;
		objectKey: string;
		tempObjectKey?: string | null;
		contentHash?: string | null;
		contentType?: string | null;
		href: string | null;
		alt: string;
		caption: string;
	};
};

export type ProfileMapBento = {
	id: string;
	type: "map";
	layout: ProfileBentoLayouts;
	content: {
		latitude: number;
		longitude: number;
		zoom: number;
		caption: string;
		url: string;
	};
};

export type ProfileBentoItem =
	| ProfileLinkBento
	| ProfileTextBento
	| ProfileSectionBento
	| ProfileMediaBento
	| ProfileMapBento;

export type ProfileResponse = {
	page: {
		id: string;
		userId: string;
		handle: string;
		name: string | null;
		role: string | null;
		bio: string | null;
		image: string | null;
		imageCrop: ProfileImageCrop | null;
		backgroundImage: string | null;
		location: string | null;
		updatedAt: string;
	};
	bento: ProfileBentoItem[];
	viewer: {
		isAuthenticated: boolean;
		userId: string | null;
		canEdit: boolean;
	};
};

export type ProfilePageResponse = {
	page: ProfileResponse["page"];
};

export type ProfilePageRecord = {
	id: string;
	userId: string;
	handle: string;
	name: string | null;
	location: string | null;
	role: string | null;
	bio: string | null;
	image: string | null;
	imageCrop: ProfileImageCrop | null;
	backgroundImage: string | null;
	createdAt: string;
	updatedAt: string;
};

export type ProfilePagesResponse = {
	pages: ProfilePageRecord[];
};
