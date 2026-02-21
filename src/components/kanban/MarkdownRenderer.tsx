import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none break-words [overflow-wrap:anywhere] [word-break:break-word] ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          // Customize link behavior for security
          a: ({ node, ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
          // Limit heading sizes
          h1: ({ node, ...props }) => <h3 {...props} />,
          h2: ({ node, ...props }) => <h4 {...props} />,
          // Style code blocks
          code: ({ node, className, children, ...props }) => {
            const isInline = !className?.includes('language-');
            return isInline ? (
              <code className="bg-muted px-1 py-0.5 rounded text-xs" {...props}>
                {children}
              </code>
            ) : (
              <code className="block bg-muted p-2 rounded text-xs overflow-x-auto" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}