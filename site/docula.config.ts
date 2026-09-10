import type { DoculaOptions } from "docula";

export const options: Partial<DoculaOptions> = {
	githubPath: "jaredwray/mockhttp",
	siteTitle: "MockHTTP",
	siteDescription:
		"HTTP mock server and httpbin replacement for API testing. Run it at mockhttp.org, in Docker, or in Node.js.",
	siteUrl: "https://mockhttp.org",
	themeMode: "light",
	enableLlmsTxt: true,
	enableReleaseChangelog: true,
	editPageUrl: "https://github.com/jaredwray/mockhttp/edit/main/site/docs",
};

export const onAutoReadme = async (content: string) =>
	content.replace(
		"[![public/logo.svg](public/logo.svg)](https://mockhttp.org)\n\n",
		"",
	);
