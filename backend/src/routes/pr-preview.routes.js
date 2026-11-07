const PROD_URL = "https://tp.dstw.dev";
const OWNER = "I-Love-Hotpot";
const REPO = "townpass-micro-service-2026";

export default async function prPreviewRoutes(app, options = {}) {
  const fetcher = options.fetcher ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;

  app.get("/api/pr-preview-links", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (!token || !token.trim()) {
      request.log.error("GITHUB_TOKEN is not configured");
      return reply.code(503).send({ error: "PR 列表服務尚未設定 GitHub token。" });
    }

    try {
      const links = [PROD_URL];
      for (let page = 1; ; page++) {
        const url = `https://api.github.com/repos/${OWNER}/${REPO}/pulls?state=open&per_page=100&page=${page}`;
        const response = await fetcher(url, {
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token.trim()}`,
            "User-Agent": "townpass-pr-preview-menu",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) {
          request.log.error({ status: response.status }, "GitHub PR request failed");
          return reply.code(502).send({
            error: `無法取得 PR 列表，GitHub 回傳 HTTP ${response.status}。`,
          });
        }

        const prs = await response.json();
        if (
          !Array.isArray(prs) ||
          !prs.every(
            (pr) =>
              pr !== null &&
              typeof pr === "object" &&
              Number.isSafeInteger(pr.number) &&
              pr.number > 0,
          )
        ) {
          request.log.error("GitHub returned invalid PR data");
          return reply.code(502).send({ error: "GitHub 回傳的 PR 資料格式錯誤。" });
        }
        links.push(...prs.map((pr) => `https://pr-${pr.number}.tp.dstw.dev`));
        if (prs.length < 100) return links;
      }
    } catch (error) {
      request.log.error({ errorType: error?.name }, "GitHub PR request failed");
      return reply.code(502).send({ error: "無法連線或解析 GitHub PR 資料。" });
    }
  });
}
