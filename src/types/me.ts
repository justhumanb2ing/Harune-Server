import type { Quotas } from "../schemas/plan";
import type { ProfileImageCrop } from "./profile";

export type MeResponse = {
	currentPlan: {
		id: string;
		name: string;
		codename: string;
		quotas: Quotas | null;
		default: boolean;
	} | null;
	profilePage: {
		id: string;
		handle: string;
		name: string | null;
		image: string | null;
		imageCrop: ProfileImageCrop | null;
	} | null;
	user: {
		id: string;
		email: string;
		name: string | null;
		image: string | null;
		createdAt: string;
		updatedAt: string;
		planId: string | null;
		credits: Record<string, number>;
	};
};
