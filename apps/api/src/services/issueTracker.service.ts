// VisionTest.ai - Issue Tracker Integration Service
// Supports creating bugs in external issue trackers (Jira, GitHub, Linear, etc.)

import { prisma } from '@visiontest/database';
import { logger } from '../utils/logger';

export interface CreateBugInput {
  projectId: string;
  comparisonId: string;
  title: string;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  screenshotUrls?: string[];
  diffUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface BugResult {
  id: string;
  externalId?: string;
  url?: string;
  provider: string;
  status: string;
  createdAt: Date;
}

type IssueTrackerProvider = 'jira' | 'github' | 'linear' | 'none';

class IssueTrackerService {
  /**
   * Create a bug in the configured issue tracker
   */
  async createBug(input: CreateBugInput): Promise<BugResult> {
    // Get project settings for issue tracker config
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { settings: true, name: true },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const settings = project.settings as any || {};
    const provider = this.getProvider(settings);

    logger.info(`Creating bug in ${provider} for comparison ${input.comparisonId}`);

    let result: BugResult;

    switch (provider) {
      case 'jira':
        result = await this.createJiraBug(input, settings.jira);
        break;
      case 'github':
        result = await this.createGitHubIssue(input, settings.github);
        break;
      case 'linear':
        result = await this.createLinearIssue(input, settings.linear);
        break;
      case 'none':
      default:
        result = await this.createInternalBug(input);
        break;
    }

    // Store bug reference in comparison metadata
    await prisma.comparison.update({
      where: { id: input.comparisonId },
      data: {
        metadata: {
          ...((await prisma.comparison.findUnique({ where: { id: input.comparisonId }, select: { metadata: true } }))?.metadata as any || {}),
          bug: {
            id: result.id,
            externalId: result.externalId,
            url: result.url,
            provider: result.provider,
            createdAt: result.createdAt.toISOString(),
          },
        },
      },
    });

    return result;
  }

  /**
   * Get the configured issue tracker provider
   */
  private getProvider(settings: any): IssueTrackerProvider {
    if (settings.jira?.enabled) return 'jira';
    if (settings.github?.enabled) return 'github';
    if (settings.linear?.enabled) return 'linear';
    return 'none';
  }

  /**
   * Create a bug in Jira
   */
  private async createJiraBug(
    input: CreateBugInput,
    config: { baseUrl: string; projectKey: string; apiToken: string; email: string }
  ): Promise<BugResult> {
    if (!config?.baseUrl || !config?.apiToken) {
      logger.warn('Jira not configured, creating internal bug');
      return this.createInternalBug(input);
    }

    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');

    const priorityMap: Record<string, string> = {
      LOW: 'Low',
      MEDIUM: 'Medium',
      HIGH: 'High',
      CRITICAL: 'Highest',
    };

    const response = await fetch(`${config.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          project: { key: config.projectKey },
          summary: input.title,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: input.description }],
              },
            ],
          },
          issuetype: { name: 'Bug' },
          priority: { name: priorityMap[input.severity] || 'Medium' },
          labels: ['visual-regression', 'visiontest-ai'],
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Jira API error:', error);
      throw new Error(`Failed to create Jira issue: ${response.status}`);
    }

    const data = await response.json() as { id: string; key: string };

    return {
      id: data.id,
      externalId: data.key,
      url: `${config.baseUrl}/browse/${data.key}`,
      provider: 'jira',
      status: 'created',
      createdAt: new Date(),
    };
  }

  /**
   * Create an issue in GitHub
   */
  private async createGitHubIssue(
    input: CreateBugInput,
    config: { owner: string; repo: string; token: string }
  ): Promise<BugResult> {
    if (!config?.owner || !config?.repo || !config?.token) {
      logger.warn('GitHub not configured, creating internal bug');
      return this.createInternalBug(input);
    }

    const labels = ['bug', 'visual-regression'];
    if (input.severity === 'CRITICAL') labels.push('priority:critical');
    else if (input.severity === 'HIGH') labels.push('priority:high');

    const body = `${input.description}\n\n---\n*Created by VisionTest.ai*\n\nComparison ID: \`${input.comparisonId}\``;

    const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/issues`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title,
        body,
        labels,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('GitHub API error:', error);
      throw new Error(`Failed to create GitHub issue: ${response.status}`);
    }

    const data = await response.json() as { id: number; number: number; html_url: string };

    return {
      id: data.id.toString(),
      externalId: `#${data.number}`,
      url: data.html_url,
      provider: 'github',
      status: 'open',
      createdAt: new Date(),
    };
  }

  /**
   * Create an issue in Linear
   */
  private async createLinearIssue(
    input: CreateBugInput,
    config: { teamId: string; apiKey: string }
  ): Promise<BugResult> {
    if (!config?.teamId || !config?.apiKey) {
      logger.warn('Linear not configured, creating internal bug');
      return this.createInternalBug(input);
    }

    const priorityMap: Record<string, number> = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4,
    };

    const mutation = `
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            url
          }
        }
      }
    `;

    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Authorization': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            teamId: config.teamId,
            title: input.title,
            description: input.description,
            priority: priorityMap[input.severity] || 3,
            labelIds: [], // Would need to look up label IDs for 'bug', 'visual-regression'
          },
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('Linear API error:', error);
      throw new Error(`Failed to create Linear issue: ${response.status}`);
    }

    const data = await response.json() as {
      data?: {
        issueCreate?: {
          issue?: { id: string; identifier: string; url: string };
        };
      };
    };
    const issue = data.data?.issueCreate?.issue;

    if (!issue) {
      throw new Error('Failed to create Linear issue');
    }

    return {
      id: issue.id,
      externalId: issue.identifier,
      url: issue.url,
      provider: 'linear',
      status: 'created',
      createdAt: new Date(),
    };
  }

  /**
   * Create an internal bug record (when no external tracker is configured)
   */
  private async createInternalBug(input: CreateBugInput): Promise<BugResult> {
    // Store as an approval request with bug type
    const comparison = await prisma.comparison.findUnique({
      where: { id: input.comparisonId },
      include: { execution: true },
    });

    if (!comparison) {
      throw new Error('Comparison not found');
    }

    // Use approval request as internal bug tracker
    const bug = await prisma.approvalRequest.create({
      data: {
        comparisonId: input.comparisonId,
        changeType: 'bug',
        severity: input.severity,
        confidence: 1.0,
        status: 'PENDING',
        comment: `${input.title}\n\n${input.description}`,
      },
    });

    logger.info(`Created internal bug: ${bug.id}`);

    return {
      id: bug.id,
      provider: 'internal',
      status: 'pending',
      createdAt: bug.createdAt,
    };
  }
}

export const issueTrackerService = new IssueTrackerService();
export default issueTrackerService;
