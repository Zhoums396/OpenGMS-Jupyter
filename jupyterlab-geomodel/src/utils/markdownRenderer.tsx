/**
 * Lightweight Markdown-to-React renderer
 * Handles: **bold**, *italic*, `code`, headers, lists (nested), paragraphs, links
 */
import * as React from 'react';

/** Render inline markdown: **bold**, *italic*, `code`, [link](url) */
function renderInline(text: string, baseKey: string = ''): React.ReactNode {
    const parts: React.ReactNode[] = [];
    // Regex handles: **bold**, *italic*, `code`, [text](url)
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`\n]+?)`|\[([^\]]+?)\]\(([^)]+?)\))/g;
    let lastIdx = 0;
    let match;
    let k = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIdx) {
            parts.push(text.slice(lastIdx, match.index));
        }
        if (match[2] !== undefined) {
            // **bold**
            parts.push(<strong key={`${baseKey}b${k++}`}>{renderInline(match[2], `${baseKey}b${k}`)}</strong>);
        } else if (match[3] !== undefined) {
            // *italic*
            parts.push(<em key={`${baseKey}i${k++}`}>{renderInline(match[3], `${baseKey}i${k}`)}</em>);
        } else if (match[4] !== undefined) {
            // `code`
            parts.push(<code key={`${baseKey}c${k++}`} className="md-inline-code">{match[4]}</code>);
        } else if (match[5] !== undefined && match[6] !== undefined) {
            // [text](url)
            parts.push(
                <a key={`${baseKey}a${k++}`} href={match[6]} target="_blank" rel="noopener noreferrer">
                    {match[5]}
                </a>
            );
        }
        lastIdx = match.index + match[0].length;
    }
    if (lastIdx < text.length) {
        parts.push(text.slice(lastIdx));
    }
    if (parts.length === 0) return text;
    if (parts.length === 1) return parts[0];
    return <>{parts}</>;
}

interface ListBlock {
    type: 'ul' | 'ol';
    items: { content: React.ReactNode; children: ListBlock | null }[];
}

/**
 * Render a markdown string to React elements.
 * Handles: headings, bold, italic, inline code, bullet/numbered lists (with nesting), paragraphs.
 */
export function renderMarkdown(text: string): React.ReactNode[] {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let keyIdx = 0;

    // Accumulate list items with indent info
    let listBuffer: { indent: number; type: 'ul' | 'ol'; text: string }[] = [];
    let paragraphBuffer: string[] = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length > 0) {
            const joined = paragraphBuffer.join('\n');
            if (joined.trim()) {
                elements.push(
                    <p key={`p${keyIdx++}`}>{renderInline(joined, `p${keyIdx}`)}</p>
                );
            }
            paragraphBuffer = [];
        }
    };

    const buildNestedList = (items: { indent: number; type: 'ul' | 'ol'; text: string }[]): React.ReactNode => {
        if (items.length === 0) return null;

        const result: React.ReactNode[] = [];
        let i = 0;
        const baseIndent = items[0].indent;
        const listType = items[0].type;

        while (i < items.length) {
            const item = items[i];
            // Collect children (items with greater indent)
            const children: typeof items = [];
            let j = i + 1;
            while (j < items.length && items[j].indent > baseIndent) {
                children.push(items[j]);
                j++;
            }

            result.push(
                <li key={`li${keyIdx++}`}>
                    {renderInline(item.text, `li${keyIdx}`)}
                    {children.length > 0 ? buildNestedList(children) : null}
                </li>
            );
            i = j;
        }

        return listType === 'ol'
            ? <ol key={`ol${keyIdx++}`}>{result}</ol>
            : <ul key={`ul${keyIdx++}`}>{result}</ul>;
    };

    const flushList = () => {
        if (listBuffer.length > 0) {
            const listEl = buildNestedList(listBuffer);
            if (listEl) elements.push(listEl);
            listBuffer = [];
        }
    };

    // Helper: check if a line is a table row
    const isTableRow = (line: string): boolean => {
        const trimmed = line.trim();
        return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 1;
    };

    // Helper: check if a line is a table separator (e.g. |---|---|---| or | :---: | --- |)
    const isTableSeparator = (line: string): boolean => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return false;
        const inner = trimmed.slice(1, -1);
        const cells = inner.split('|');
        return cells.every(cell => /^\s*:?-{2,}:?\s*$/.test(cell));
    };

    // Helper: parse table cells from a row line
    const parseTableCells = (line: string): string[] => {
        const trimmed = line.trim();
        const inner = trimmed.slice(1, -1); // remove leading/trailing |
        return inner.split('|').map(cell => cell.trim());
    };

    // Helper: flush a table buffer into a <table> element
    const flushTable = (tableLines: string[]) => {
        if (tableLines.length < 2) {
            // Not enough lines for a table, treat as paragraphs
            tableLines.forEach(l => paragraphBuffer.push(l));
            return;
        }

        // Find separator line
        let sepIdx = -1;
        for (let ti = 0; ti < tableLines.length; ti++) {
            if (isTableSeparator(tableLines[ti])) {
                sepIdx = ti;
                break;
            }
        }

        const headerRows = sepIdx > 0 ? tableLines.slice(0, sepIdx) : [];
        const bodyRows = sepIdx >= 0 ? tableLines.slice(sepIdx + 1) : tableLines;

        elements.push(
            <table key={`tbl${keyIdx++}`} className="md-table">
                {headerRows.length > 0 && (
                    <thead>
                        {headerRows.map((row, ri) => (
                            <tr key={`thr${keyIdx++}`}>
                                {parseTableCells(row).map((cell, ci) => (
                                    <th key={`th${keyIdx++}`}>{renderInline(cell, `th${keyIdx}`)}</th>
                                ))}
                            </tr>
                        ))}
                    </thead>
                )}
                <tbody>
                    {bodyRows.map((row, ri) => (
                        <tr key={`tbr${keyIdx++}`}>
                            {parseTableCells(row).map((cell, ci) => (
                                <td key={`td${keyIdx++}`}>{renderInline(cell, `td${keyIdx}`)}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    let tableBuffer: string[] = [];

    const flushTableBuffer = () => {
        if (tableBuffer.length > 0) {
            flushTable(tableBuffer);
            tableBuffer = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Table row detection (must come before other matchers)
        if (isTableRow(line) || (tableBuffer.length > 0 && isTableSeparator(line))) {
            flushParagraph();
            flushList();
            tableBuffer.push(line);
            continue;
        } else if (tableBuffer.length > 0) {
            // End of table
            flushTableBuffer();
        }

        // Horizontal rule: --- or *** or ___
        if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
            flushParagraph();
            flushList();
            elements.push(<hr key={`hr${keyIdx++}`} />);
            continue;
        }

        // Heading: # to ####
        const headingMatch = line.match(/^(#{1,4})\s+(.+)/);
        if (headingMatch) {
            flushParagraph();
            flushList();
            const level = headingMatch[1].length;
            const HeadTag = (`h${level}`) as any;
            elements.push(
                <HeadTag key={`h${keyIdx++}`}>{renderInline(headingMatch[2], `h${keyIdx}`)}</HeadTag>
            );
            continue;
        }

        // Unordered list: leading spaces/tabs + - or * followed by space
        const ulMatch = line.match(/^(\s*)([-*])\s+(.+)/);
        if (ulMatch) {
            flushParagraph();
            const indent = ulMatch[1].length;
            listBuffer.push({ indent, type: 'ul', text: ulMatch[3] });
            continue;
        }

        // Ordered list: leading spaces + number. + space
        const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)/);
        if (olMatch) {
            flushParagraph();
            const indent = olMatch[1].length;
            listBuffer.push({ indent, type: 'ol', text: olMatch[3] });
            continue;
        }

        // Empty line
        if (line.trim() === '') {
            flushList();
            flushParagraph();
            continue;
        }

        // Regular text — if we're in a list context and this line is continuation, 
        // treat as new paragraph
        flushList();
        paragraphBuffer.push(line);
    }

    flushTableBuffer();
    flushList();
    flushParagraph();

    return elements;
}
