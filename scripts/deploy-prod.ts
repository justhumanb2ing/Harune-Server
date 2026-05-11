import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const envPath = fileURLToPath(String(new URL("../.env.prod", import.meta.url)));

const deploy = spawnSync(
	"bunx",
	["wrangler", "deploy", "--minify", "--keep-vars", "--secrets-file", envPath],
	{
		stdio: "inherit",
		encoding: "utf8",
	},
);

if (deploy.status !== 0) {
	throw new Error("Deployment failed");
}
