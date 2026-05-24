import { useState } from 'react';

const styles = {
  container: {
    maxWidth: 1000,
    margin: '0 auto',
    padding: '40px 24px',
    fontFamily: "'Playfair Display', Georgia, serif",
    backgroundColor: '#fafaf8',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '48px',
    borderBottom: '2px solid #1a1a1a',
    paddingBottom: '24px',
  },
  title: {
    fontSize: '48px',
    fontWeight: '700',
    margin: '0 0 12px 0',
    letterSpacing: '-1px',
    color: '#1a1a1a',
  },
  inputSection: {
    marginBottom: '32px',
  },
  input: {
    width: '100%',
    padding: '14px 18px',
    fontSize: '16px',
    border: '2px solid #1a1a1a',
    borderRadius: '2px',
    fontFamily: "'Playfair Display', Georgia, serif",
    marginBottom: '12px',
    backgroundColor: '#fff',
    color: '#1a1a1a',
    letterSpacing: '0.5px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginBottom: '32px',
  },
  button: {
    padding: '12px 28px',
    fontSize: '16px',
    borderRadius: '2px',
    border: '2px solid #1a1a1a',
    cursor: 'pointer',
    fontWeight: '700',
    transition: 'all 0.3s',
    fontFamily: "'Playfair Display', Georgia, serif",
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
  },
  proposalCard: {
    border: '2px solid #1a1a1a',
    borderRadius: '2px',
    padding: '24px',
    marginBottom: '24px',
    backgroundColor: '#fff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  riskBadge: (level) => {
    const colors = {
      SAFE_READ: { bg: '#d4edda', text: '#155724', border: '#c3e6cb' },
      MUTATING: { bg: '#fff3cd', text: '#856404', border: '#ffeaa7' },
      DESTRUCTIVE: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
      BLOCKED: { bg: '#f8d7da', text: '#721c24', border: '#f5c6cb' },
    };
    const color = colors[level] || colors.SAFE_READ;
    return {
      display: 'inline-block',
      backgroundColor: color.bg,
      color: color.text,
      border: `1px solid ${color.border}`,
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
    };
  },
  output: {
    background: '#0f172a',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: '8px',
    minHeight: '200px',
    maxHeight: '400px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '13px',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  errorMsg: {
    color: '#dc3545',
    padding: '8px 12px',
    backgroundColor: '#f8d7da',
    borderRadius: '4px',
    marginTop: '8px',
  },
};

export default function App() {
  const [message, setMessage] = useState('');
  const [proposal, setProposal] = useState(null);
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);

  async function propose() {
    setLoading(true);
    setOutput('');
    try {
      const response = await fetch('/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate proposal');
      }

      setProposal(data.proposal);
    } catch (error) {
      setProposal(null);
      setOutput(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function runApproved() {
    if (!proposal?.id) return;

    setLoading(true);
    setStreaming(true);
    setOutput('▶ Starting execution...\n');

    try {
      const response = await fetch('/execute-approved-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposalId: proposal.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Execution failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const event = line.replace('event:', '').trim();
            if (event === 'end') {
              setOutput((prev) => prev + '\n✅ Execution complete\n');
            } else if (event === 'error') {
              setOutput((prev) => prev + '\n❌ Error during execution\n');
            }
          } else if (line.startsWith('data:')) {
            const data = JSON.parse(line.replace('data:', '').trim());
            if (data.chunk) {
              setOutput((prev) => prev + data.chunk);
            }
          }
        }
      }
    } catch (error) {
      setOutput((prev) => `${prev}\n❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  }

  const isBlocked = proposal && !proposal.policy?.allowed;
  const isMutating = proposal && proposal.riskLevel === 'MUTATING';
  const isSafeRead = proposal && proposal.riskLevel === 'SAFE_READ';

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>🤖 AI Terminal</h1>
          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
            Type natural language, get safe PowerShell commands
          </p>
        </div>
      </div>

      <div style={styles.inputSection}>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && propose()}
          placeholder="e.g., list files in downloads, create a new folder, show current directory"
          style={styles.input}
          disabled={loading}
        />
      </div>

      <div style={styles.buttonGroup}>
        <button
          onClick={propose}
          disabled={loading || !message.trim()}
          style={{
            ...styles.button,
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: '#fff',
          }}
        >
          {loading && !streaming ? '⏳ Proposing...' : '✨ Propose Command'}
        </button>
        <button
          onClick={runApproved}
          disabled={loading || !proposal || isBlocked}
          style={{
            ...styles.button,
            backgroundColor:
              loading || !proposal || isBlocked ? '#ccc' : '#28a745',
            color: '#fff',
          }}
        >
          {loading && streaming ? '⏳ Running...' : '▶ Execute'}
        </button>
      </div>

      {proposal && (
        <div style={styles.proposalCard}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              marginBottom: '12px',
            }}
          >
            <h3 style={{ margin: '0', fontSize: '16px' }}>
              📋 Command Proposal
            </h3>
            <div style={styles.riskBadge(proposal.riskLevel)}>
              {proposal.riskLevel}
            </div>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong>Intent:</strong> {proposal.intent}
          </div>

          <div
            style={{
              backgroundColor: '#f8f9fa',
              border: '1px solid #dee2e6',
              padding: '8px 12px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '13px',
              marginBottom: '8px',
              wordBreak: 'break-all',
            }}
          >
            <strong>Command:</strong> {proposal.command}
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong>Mode:</strong>{' '}
            <span style={{ color: '#666' }}>
              {proposal.translationMode} ({proposal.source})
            </span>
          </div>

          <div style={{ marginBottom: '8px' }}>
            <strong>Confidence:</strong>{' '}
            <span style={{ color: '#666' }}>
              {Math.round(proposal.confidence * 100)}%
            </span>
          </div>

          {isBlocked && (
            <div style={styles.errorMsg}>
              <strong>🚫 Blocked by Policy</strong>
              {proposal.policy?.reasons?.length && (
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {proposal.policy.reasons.map((reason, i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {isMutating && !isBlocked && (
            <div
              style={{
                ...styles.errorMsg,
                backgroundColor: '#fff3cd',
                color: '#856404',
                border: '1px solid #ffeaa7',
              }}
            >
              <strong>⚠️ Requires Approval</strong>
              <p style={{ margin: '4px 0 0 0' }}>
                This command modifies files or system state. Review carefully
                before running.
              </p>
            </div>
          )}

          {isSafeRead && (
            <div
              style={{
                ...styles.errorMsg,
                backgroundColor: '#d4edda',
                color: '#155724',
                border: '1px solid #c3e6cb',
              }}
            >
              ✅ Safe read-only command
            </div>
          )}

          {proposal.explanation && (
            <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
              <strong>Explanation:</strong> {proposal.explanation}
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: '12px' }}>
        <strong style={{ display: 'block', marginBottom: '4px' }}>
          Output {streaming && '(streaming)'}:
        </strong>
      </div>
      <div style={styles.output}>{output || '(no output yet)'}</div>
    </div>
  );
}
