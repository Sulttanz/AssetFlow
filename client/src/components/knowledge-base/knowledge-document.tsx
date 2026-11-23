import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import "./knowledge-document.css";

// Support semantic inline HTML, not author-supplied styling or active content.
// Stripping class/style/hidden attributes also prevents invisible text or UI
// classes from being injected into otherwise legitimate manual sentences.
const documentSchema: typeof defaultSchema = {
  ...defaultSchema,
  strip: [...(defaultSchema.strip ?? []), "script", "style", "iframe", "object", "embed"],
  tagNames: [...(defaultSchema.tagNames ?? []), "kbd", "span", "mark"],
  attributes: {
    ...defaultSchema.attributes,
    "*": (defaultSchema.attributes?.["*"] ?? []).filter(attribute =>
      !["className", "style", "hidden", "id", "name", "dir"].includes(typeof attribute === "string" ? attribute : attribute[0])),
    a: ["href", "title"],
    span: [],
    strong: [],
    b: [],
    kbd: [],
    mark: [],
    img: ["alt", "title"],
  },
};
const components: Components = {
  img: ({ alt }) => <span className="kb-image-placeholder">[Image omitted{alt ? `: ${alt}` : ""}]</span>,
  a: ({ href, children, title }) => {
    const external = /^https?:\/\//i.test(href ?? "");
    return <a href={href} title={title} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>{children}</a>;
  },
  table: ({ children }) => <div className="kb-table-scroll" role="region" aria-label="Article table" tabIndex={0}><table>{children}</table></div>,
};

/** Shared by current/historical article views and author preview. */
export function KnowledgeDocument({ content, className = "" }: { content: string; className?: string }) {
  return <article className={`kb-document ${className}`.trim()} dir="ltr" data-testid="knowledge-document">
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, [rehypeSanitize, documentSchema]]} components={components}>
      {content}
    </ReactMarkdown>
  </article>;
}
