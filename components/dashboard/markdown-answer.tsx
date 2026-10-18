import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

// Raw HTML in model output is not rendered (react-markdown escapes it).
const components: Components = {
  p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
  ),
  h1: ({ children }) => <h3 className="mt-4 mb-2 font-semibold">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-4 mb-2 font-semibold">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-3 mb-1 font-semibold">{children}</h4>,
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-background px-1 py-0.5 font-mono text-xs">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-background p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded-lg border bg-background">
      <table className="w-full text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b px-3 py-2 font-medium whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b px-3 py-2 tabular-nums [tr:last-child_&]:border-0">
      {children}
    </td>
  ),
  hr: () => <hr className="my-3 border-border" />,
}

export function MarkdownAnswer({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  )
}
