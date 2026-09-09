import React from "react";

/** Inline: **bold** and [text](url). */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(<strong key={`${keyBase}-b${i}`}>{m[1]}</strong>);
    } else {
      nodes.push(
        <a key={`${keyBase}-a${i}`} href={m[3]} target="_blank" rel="noopener noreferrer">
          {m[2]}
        </a>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r/g, "").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    let line = lines[i];

    if (!line.trim()) { i++; continue; }

    // heading
    if (/^#{1,4}\s/.test(line)) {
      const text = line.replace(/^#{1,4}\s/, "");
      blocks.push(<h4 key={key++}>{inline(text, `h${key}`)}</h4>);
      i++;
      continue;
    }

    // pipe table
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[-:\s|]+\|[-:\s|]+$/.test(lines[i + 1])) {
      const header = line.split("|").map((c) => c.trim()).filter((_, idx, arr) => !(idx === 0 && arr[0] === "") && !(idx === arr.length - 1 && arr[arr.length - 1] === ""));
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const cells = lines[i].split("|").map((c) => c.trim());
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        rows.push(cells);
        i++;
      }
      blocks.push(
        <table key={key++}>
          <thead>
            <tr>{header.map((h, hi) => <th key={hi}>{inline(h, `th${key}-${hi}`)}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td${key}-${ri}-${ci}`)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++}>
          {items.map((it, ii) => <li key={ii}>{inline(it, `li${key}-${ii}`)}</li>)}
        </ul>
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++}>
          {items.map((it, ii) => <li key={ii}>{inline(it, `ol${key}-${ii}`)}</li>)}
        </ol>
      );
      continue;
    }

    // paragraph (single line; blocks are blank-line separated in our content)
    blocks.push(<p key={key++}>{inline(line, `p${key}`)}</p>);
    i++;
  }

  return <div className="md">{blocks}</div>;
}
