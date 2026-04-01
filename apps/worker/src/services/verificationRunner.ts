import { execSync } from 'child_process';
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { logger } from '../utils/logger';

interface VerificationStep {
  name: string;
  command: string;
  timeout?: number; // ms, default 120000
}

interface VerificationStepResult {
  name: string;
  command: string;
  status: 'passed' | 'failed' | 'timeout' | 'error';
  output: string;
  duration: number;
}

interface VerificationResult {
  outcome: 'passed' | 'failed' | 'partial';
  steps: VerificationStepResult[];
  summary: string;
  durationMs: number;
}

export class VerificationRunner {
  private isKubernetes: boolean;

  constructor() {
    this.isKubernetes = !!process.env.KUBERNETES_SERVICE_HOST;
  }

  async run(params: {
    workingDir: string; // Directory with cloned+patched repo
    steps: VerificationStep[];
    containerImage?: string;
    fixSessionId: string;
  }): Promise<VerificationResult> {
    if (this.isKubernetes) {
      return this.runInKubernetesJob(params);
    }
    return this.runInDocker(params);
  }

  private async runInDocker(params: {
    workingDir: string;
    steps: VerificationStep[];
    containerImage?: string;
    fixSessionId: string;
  }): Promise<VerificationResult> {
    const image = params.containerImage || 'node:20-slim';
    const startTime = Date.now();
    const results: VerificationStepResult[] = [];

    // Build a script that runs all steps and captures results
    const script = params.steps.map((step, i) => `
echo "STEP_START_${i}"
START_${i}=$(date +%s%N)
${step.command} 2>&1
EXIT_${i}=$?
END_${i}=$(date +%s%N)
echo "STEP_END_${i}_EXIT_$EXIT_${i}"
`).join('\n');

    try {
      const output = execSync(
        `docker run --rm -v "${params.workingDir}:/workspace" -w /workspace ${image} /bin/sh -c '${script.replace(/'/g, "'\\''")}'`,
        { timeout: 900000, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
      );

      // Parse step results from output
      for (let i = 0; i < params.steps.length; i++) {
        const stepStart = output.indexOf(`STEP_START_${i}`);
        const stepEnd = output.indexOf(`STEP_END_${i}_EXIT_`);
        const exitMatch = output.slice(stepEnd).match(/STEP_END_\d+_EXIT_(\d+)/);
        const exitCode = exitMatch ? parseInt(exitMatch[1]) : 1;
        const stepOutput = stepStart >= 0 && stepEnd >= 0
          ? output.slice(stepStart + `STEP_START_${i}`.length + 1, stepEnd).trim()
          : '';

        results.push({
          name: params.steps[i].name,
          command: params.steps[i].command,
          status: exitCode === 0 ? 'passed' : 'failed',
          output: stepOutput.slice(0, 5000),
          duration: 0,
        });
      }
    } catch (err: any) {
      // Docker run failed entirely
      for (const step of params.steps) {
        if (!results.find(r => r.name === step.name)) {
          results.push({
            name: step.name,
            command: step.command,
            status: err.killed ? 'timeout' : 'error',
            output: (err.stderr || err.message || '').slice(0, 5000),
            duration: 0,
          });
        }
      }
    }

    const passed = results.filter(r => r.status === 'passed').length;
    const total = results.length;
    const durationMs = Date.now() - startTime;

    return {
      outcome: passed === total ? 'passed' : passed === 0 ? 'failed' : 'partial',
      steps: results,
      summary: `${passed}/${total} verification steps passed`,
      durationMs,
    };
  }

  private async runInKubernetesJob(params: {
    workingDir: string;
    steps: VerificationStep[];
    containerImage?: string;
    fixSessionId: string;
  }): Promise<VerificationResult> {
    // For now, use the Docker fallback even in K8s
    // Full K8s Job implementation requires @kubernetes/client-node
    // and MinIO workspace upload, which will be wired in a follow-up
    logger.info('K8s Job verification not yet implemented, falling back to Docker');
    return this.runInDocker(params);
  }
}
