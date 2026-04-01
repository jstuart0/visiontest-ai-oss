import simpleGit, { SimpleGit } from 'simple-git';
import { Octokit } from '@octokit/rest';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeFile } from 'fs/promises';
import { logger } from '../utils/logger';

interface RepoConnection {
  provider: string; // GITHUB | GITLAB | BITBUCKET | LOCAL
  repoUrl: string;
  defaultBranch: string;
  encryptedToken: string | null;
  cloneStrategy: string;
}

interface PullRequestParams {
  title: string;
  body: string;
  branchName: string;
  baseBranch: string;
  labels?: string[];
}

export class GitService {
  async cloneRepo(conn: RepoConnection, targetDir: string): Promise<SimpleGit> {
    // Build clone URL with token auth
    let cloneUrl = conn.repoUrl;
    if (conn.encryptedToken && conn.provider !== 'LOCAL') {
      // Insert token into HTTPS URL: https://TOKEN@github.com/user/repo.git
      const url = new URL(conn.repoUrl);
      url.username = conn.encryptedToken; // Note: caller must decrypt before passing
      cloneUrl = url.toString();
    }

    const depthArgs = conn.cloneStrategy === 'shallow' ? ['--depth', '1'] : [];
    const git = simpleGit();
    await git.clone(cloneUrl, targetDir, [...depthArgs, '--branch', conn.defaultBranch]);
    logger.info(`Cloned ${conn.repoUrl} to ${targetDir}`);
    return simpleGit(targetDir);
  }

  async createBranch(git: SimpleGit, branchName: string): Promise<void> {
    await git.checkoutLocalBranch(branchName);
    logger.info(`Created and checked out branch: ${branchName}`);
  }

  async applyPatchFiles(
    targetDir: string,
    files: Array<{ path: string; patched: string }>
  ): Promise<void> {
    for (const file of files) {
      const fullPath = join(targetDir, file.path);
      await writeFile(fullPath, file.patched, 'utf-8');
      logger.info(`Patched file: ${file.path}`);
    }
  }

  async commitAndPush(
    git: SimpleGit,
    message: string,
    branchName: string
  ): Promise<string> {
    await git.add('.');
    await git.commit(message);
    await git.push('origin', branchName, ['--set-upstream']);
    const log = await git.log({ maxCount: 1 });
    logger.info(`Pushed branch ${branchName}, commit: ${log.latest?.hash}`);
    return log.latest?.hash || '';
  }

  async createPullRequest(
    conn: RepoConnection,
    params: PullRequestParams
  ): Promise<{ url: string; number: number }> {
    if (conn.provider === 'GITHUB') {
      return this.createGitHubPR(conn, params);
    } else if (conn.provider === 'GITLAB') {
      return this.createGitLabMR(conn, params);
    }
    throw new Error(`PR creation not supported for provider: ${conn.provider}`);
  }

  private async createGitHubPR(
    conn: RepoConnection,
    params: PullRequestParams
  ): Promise<{ url: string; number: number }> {
    const octokit = new Octokit({ auth: conn.encryptedToken });

    // Parse owner/repo from URL
    const match = conn.repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!match) throw new Error(`Cannot parse GitHub owner/repo from: ${conn.repoUrl}`);
    const [, owner, repo] = match;

    const { data } = await octokit.pulls.create({
      owner,
      repo,
      title: params.title,
      body: params.body,
      head: params.branchName,
      base: params.baseBranch,
    });

    if (params.labels?.length) {
      await octokit.issues.addLabels({
        owner,
        repo,
        issue_number: data.number,
        labels: params.labels,
      });
    }

    logger.info(`Created GitHub PR #${data.number}: ${data.html_url}`);
    return { url: data.html_url, number: data.number };
  }

  private async createGitLabMR(
    conn: RepoConnection,
    params: PullRequestParams
  ): Promise<{ url: string; number: number }> {
    // Parse project path from GitLab URL
    const match = conn.repoUrl.match(/gitlab\.com[/:](.+?)(?:\.git)?$/);
    if (!match) throw new Error(`Cannot parse GitLab project from: ${conn.repoUrl}`);
    const projectPath = encodeURIComponent(match[1]);

    const baseUrl = conn.repoUrl.includes('gitlab.com')
      ? 'https://gitlab.com'
      : new URL(conn.repoUrl).origin;

    const response = await fetch(`${baseUrl}/api/v4/projects/${projectPath}/merge_requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PRIVATE-TOKEN': conn.encryptedToken || '',
      },
      body: JSON.stringify({
        title: params.title,
        description: params.body,
        source_branch: params.branchName,
        target_branch: params.baseBranch,
        labels: params.labels?.join(',') || '',
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`GitLab MR creation failed (${response.status}): ${text}`);
    }

    const data = await response.json() as any;
    logger.info(`Created GitLab MR !${data.iid}: ${data.web_url}`);
    return { url: data.web_url, number: data.iid };
  }

  async createTempDir(): Promise<string> {
    return mkdtemp(join(tmpdir(), 'vt-fix-'));
  }

  async cleanup(dir: string): Promise<void> {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (err) {
      logger.warn(`Failed to cleanup temp dir: ${dir}`, err);
    }
  }
}
