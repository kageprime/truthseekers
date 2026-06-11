import fs from "node:fs";
import path from "node:path";
import git from "isomorphic-git";
import http from "isomorphic-git/http/node/index.js";
import type { Article } from "@encarta/core";

const REPO_PATH = process.env.ENCARTA_REPO_PATH || path.join(process.cwd(), "data", "encyclopedia");

let repoInitialized = false;

async function ensureRepo(): Promise<void> {
  if (repoInitialized) return;

  if (!fs.existsSync(REPO_PATH)) {
    fs.mkdirSync(REPO_PATH, { recursive: true });
  }

  try {
    await git.log({ fs, dir: REPO_PATH, depth: 1 });
    repoInitialized = true;
  } catch {
    await git.init({ fs, dir: REPO_PATH });
    repoInitialized = true;
  }
}

export async function commitArticle(article: Article): Promise<string> {
  await ensureRepo();

  const filePath = path.join(REPO_PATH, `${article.slug}.json`);
  const content = JSON.stringify(article, null, 2);

  fs.writeFileSync(filePath, content, "utf-8");

  await git.add({ fs, dir: REPO_PATH, filepath: `${article.slug}.json` });

  const sha = await git.commit({
    fs,
    dir: REPO_PATH,
    message: `v${article.metadata.version}: ${article.title}`,
    author: {
      name: "Truthseekers Agent",
      email: "agent@encarta.local",
    },
  });

  return sha;
}

export async function getArticleHistory(slug: string): Promise<{ sha: string; message: string; timestamp: number }[]> {
  await ensureRepo();

  const log = await git.log({
    fs,
    dir: REPO_PATH,
    filepath: `${slug}.json`,
  });

  return log.map((entry) => ({
    sha: entry.oid,
    message: entry.commit.message,
    timestamp: entry.commit.committer.timestamp,
  }));
}

export async function getArticleAtVersion(
  slug: string,
  sha: string
): Promise<Article | null> {
  try {
    const { blob } = await git.readBlob({
      fs,
      dir: REPO_PATH,
      oid: sha,
      filepath: `${slug}.json`,
    });
    const text = Buffer.from(blob).toString("utf-8");
    return JSON.parse(text) as Article;
  } catch {
    return null;
  }
}

export async function getRepoStatus(): Promise<{ files: string[]; modified: boolean }> {
  await ensureRepo();
  const statusMatrix = await git.statusMatrix({ fs, dir: REPO_PATH });
  const changed = statusMatrix.filter((row) => row[2] !== 1 || row[3] !== 1);
  return {
    files: changed.map((row) => row[0]),
    modified: changed.length > 0,
  };
}
