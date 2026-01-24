/**
 * Code Preview Component
 */
import * as React from 'react';

interface IProps {
  code: string;
}

export const CodePreview: React.FC<IProps> = ({ code }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!code) {
    return (
      <div className="geomodel-code-preview empty">
        <p>Code will be generated after parameters are filled</p>
      </div>
    );
  }

  return (
    <div className="geomodel-code-preview">
      <div className="code-header">
        <span>Code Preview</span>
        <button onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="code-content">
        <code>{code}</code>
      </pre>
    </div>
  );
};
