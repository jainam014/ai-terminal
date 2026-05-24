#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

const BASE_URL = process.env.AI_BACKEND_URL || 'http://localhost:5000';

function request(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(endpoint, BASE_URL);

    const req = http.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          let parsed = {};
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch (_error) {
            parsed = { raw };
          }

          if ((res.statusCode || 500) >= 400) {
            const error = new Error(parsed.error || `HTTP ${res.statusCode}`);
            error.status = res.statusCode;
            error.payload = parsed;
            reject(error);
            return;
          }

          resolve(parsed);
        });
      }
    );

    req.on('error', reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function askYesNo(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(`${prompt} (y/n): `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  const autoYes = args.includes('--yes');
  const filteredArgs = args.filter((item) => item !== '--yes');
  const message = filteredArgs.join(' ').trim();

  if (!message) {
    console.log('Usage: ai "<natural language request>" [--yes]');
    process.exit(1);
    return;
  }

  try {
    await request('GET', '/health');

    const proposalResponse = await request('POST', '/propose', { message });
    const proposal = proposalResponse.proposal;

    console.log(`Intent  : ${proposal.intent}`);
    console.log(`Command : ${proposal.command}`);
    console.log(`Risk    : ${proposal.riskLevel}`);
    console.log(`Source  : ${proposal.source} (${proposal.translationMode || 'unknown'})`);

    if (!proposal.policy || !proposal.policy.allowed) {
      console.log('Blocked by policy.');
      const reasons = (proposal.policy && proposal.policy.reasons) || [];
      reasons.forEach((reason) => console.log(`- ${reason}`));
      process.exit(2);
      return;
    }

    if (proposal.needsConfirmation && !autoYes) {
      const approved = await askYesNo('Approve execution?');
      if (!approved) {
        console.log('Cancelled.');
        process.exit(0);
        return;
      }
    }

    const resultResponse = await request('POST', '/execute-approved', {
      proposalId: proposal.id,
    });

    const result = resultResponse.result;
    console.log(`ExitCode: ${result.exitCode}`);

    if (result.stdout) {
      process.stdout.write(result.stdout);
    }

    if (result.stderr) {
      process.stderr.write(result.stderr);
    }

    process.exit(result.ok ? 0 : 1);
  } catch (error) {
    const safeMessage = String(error && error.message ? error.message : '').trim();
    const headline = safeMessage || (error && error.status ? `HTTP ${error.status}` : 'Unknown error');
    console.error(`Error: ${headline}`);

    if (error && error.status) {
      console.error(`Status: ${error.status}`);
    }

    if (error.payload && Array.isArray(error.payload.reasons)) {
      error.payload.reasons.forEach((reason) => console.error(`- ${reason}`));
    }

    if (error.payload && error.payload.error && String(error.payload.error).trim() !== '') {
      console.error(`Detail: ${error.payload.error}`);
    }

    if (error.payload && error.payload.raw) {
      console.error(`Raw: ${error.payload.raw}`);
    }

    process.exit(1);
  }
}

main();
