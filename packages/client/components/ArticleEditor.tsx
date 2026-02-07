'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

interface Article {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  categoryId: string | null;
  tags: string[];
  status: string;
  authorName: string;
  authorEmail: string;
  viewCount: number;
  featured: boolean;
  createdDate: string;
  lastModified: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  sortOrder: number;
  status: string;
  articleCount: number;
}

interface ArticleEditorProps {
  article: Article | null;
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

// Simple Markdown preview renderer
function renderMarkdownPreview(content: string): string {
  if (!content) return '<p class="text-base-content/50 italic">Start typing to see preview...</p>';

  let html = content;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-6 mb-2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-base-300 rounded p-3 my-3 overflow-x-auto text-sm"><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 py-0.5 rounded text-sm">$1</code>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary hover:underline">$1</a>'
  );

  // Lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-4">$1</li>');

  // Paragraphs
  html = html
    .split('\n\n')
    .map((block) => {
      if (
        block.startsWith('<h') ||
        block.startsWith('<ul') ||
        block.startsWith('<pre') ||
        block.startsWith('<li')
      ) {
        return block;
      }
      if (block.trim()) {
        return `<p class="my-2">${block.replace(/\n/g, '<br>')}</p>`;
      }
      return '';
    })
    .join('');

  return html;
}

export default function ArticleEditor({ article, categories, onClose, onSave }: ArticleEditorProps) {
  const { data: session } = useSession();
  const [formData, setFormData] = useState({
    title: '',
    summary: '',
    content: '',
    categoryId: '',
    tags: [] as string[],
    status: 'Draft',
    featured: false,
  });
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEditing = !!article;

  // Insert formatting at cursor position
  const insertFormatting = (before: string, after: string = '', placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const selectedText = text.substring(start, end) || placeholder;

    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);

    setFormData(prev => ({ ...prev, content: newText }));

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(
        start + before.length,
        start + before.length + selectedText.length
      );
    }, 0);
  };

  const insertAtNewLine = (prefix: string, placeholder: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const text = formData.content;

    // Find start of current line
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const beforeLine = text.substring(0, lineStart);
    const afterCursor = text.substring(start);

    const newText = beforeLine + prefix + placeholder + afterCursor;

    setFormData(prev => ({ ...prev, content: newText }));

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + prefix.length, lineStart + prefix.length + placeholder.length);
    }, 0);
  };

  useEffect(() => {
    if (article) {
      setFormData({
        title: article.title,
        summary: article.summary,
        content: article.content,
        categoryId: article.categoryId || '',
        tags: article.tags || [],
        status: article.status,
        featured: article.featured,
      });
    }
  }, [article]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tagToRemove),
    }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = isEditing
        ? `${apiUrl}/api/knowledge-articles/${article.id}`
        : `${apiUrl}/api/knowledge-articles`;

      const body = {
        title: formData.title,
        summary: formData.summary,
        content: formData.content,
        categoryId: formData.categoryId || null,
        tags: formData.tags,
        status: formData.status,
        featured: formData.featured,
        authorName: (session?.user as any)?.name || '',
        authorEmail: (session?.user as any)?.email || '',
      };

      const response = await fetch(url, {
        method: isEditing ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.success) {
        onSave();
      } else {
        throw new Error(data.error || 'Failed to save article');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save article');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-base-content">
            {isEditing ? 'Edit Article' : 'New Article'}
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="alert alert-error mb-4">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="label">
                <span className="label-text font-medium">Title *</span>
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Article title"
                className="input input-bordered w-full"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Category</span>
              </label>
              <select
                name="categoryId"
                value={formData.categoryId}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="">Select a category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Status</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select select-bordered w-full"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-medium">Summary</span>
              <span className="label-text-alt text-base-content/50">Brief description for listings</span>
            </label>
            <textarea
              name="summary"
              value={formData.summary}
              onChange={handleChange}
              placeholder="A brief summary of the article..."
              className="textarea textarea-bordered w-full h-20"
            />
          </div>

          {/* Content */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="label py-0">
                <span className="label-text font-medium">Content (Markdown)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(!showPreview)}
                className="btn btn-ghost btn-xs gap-1"
              >
                {showPreview ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Preview
                  </>
                )}
              </button>
            </div>

            {/* Formatting Toolbar */}
            {!showPreview && (
              <div className="flex flex-wrap gap-1 mb-2 p-2 bg-base-200 rounded-t-lg border border-b-0 border-base-300">
                <button
                  type="button"
                  onClick={() => insertFormatting('**', '**', 'bold text')}
                  className="btn btn-ghost btn-xs font-bold"
                  title="Bold (Ctrl+B)"
                >
                  B
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('*', '*', 'italic text')}
                  className="btn btn-ghost btn-xs italic"
                  title="Italic (Ctrl+I)"
                >
                  I
                </button>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('# ', 'Heading')}
                  className="btn btn-ghost btn-xs"
                  title="Heading 1"
                >
                  H1
                </button>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('## ', 'Heading')}
                  className="btn btn-ghost btn-xs"
                  title="Heading 2"
                >
                  H2
                </button>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('### ', 'Heading')}
                  className="btn btn-ghost btn-xs"
                  title="Heading 3"
                >
                  H3
                </button>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('- ', 'list item')}
                  className="btn btn-ghost btn-xs"
                  title="Bullet List"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('1. ', 'list item')}
                  className="btn btn-ghost btn-xs"
                  title="Numbered List"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                  </svg>
                </button>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                  type="button"
                  onClick={() => insertFormatting('[', '](https://)', 'link text')}
                  className="btn btn-ghost btn-xs"
                  title="Link"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('`', '`', 'code')}
                  className="btn btn-ghost btn-xs font-mono"
                  title="Inline Code"
                >
                  {'</>'}
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n```\n', '\n```\n', 'code block')}
                  className="btn btn-ghost btn-xs"
                  title="Code Block"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
                <div className="divider divider-horizontal mx-0"></div>
                <button
                  type="button"
                  onClick={() => insertAtNewLine('> ', 'quote')}
                  className="btn btn-ghost btn-xs"
                  title="Quote"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('\n---\n', '', '')}
                  className="btn btn-ghost btn-xs"
                  title="Horizontal Line"
                >
                  ─
                </button>
              </div>
            )}

            {showPreview ? (
              <div
                className="border border-base-300 rounded-lg p-4 min-h-[200px] max-h-[400px] overflow-y-auto bg-base-200"
                dangerouslySetInnerHTML={{ __html: renderMarkdownPreview(formData.content) }}
              />
            ) : (
              <textarea
                ref={textareaRef}
                name="content"
                value={formData.content}
                onChange={handleChange}
                placeholder="Write your article content here using Markdown...

# Heading 1
## Heading 2
### Heading 3

**Bold text** and *italic text*

- Bullet point 1
- Bullet point 2

1. Numbered item
2. Another item

`inline code` or code blocks:

```
code block here
```

[Link text](https://example.com)"
                className="textarea textarea-bordered w-full h-64 font-mono text-sm rounded-t-none"
              />
            )}

            <div className="text-xs text-base-content/50 mt-1">
              Click the toolbar buttons above or type Markdown directly
            </div>
          </div>

          {/* Tags */}
          <div className="mb-4">
            <label className="label">
              <span className="label-text font-medium">Tags</span>
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a tag..."
                className="input input-bordered input-sm flex-1"
              />
              <button type="button" onClick={handleAddTag} className="btn btn-sm btn-primary">
                Add
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="badge badge-primary gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-error"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Featured */}
          <div className="form-control">
            <label className="label cursor-pointer justify-start gap-3">
              <input
                type="checkbox"
                name="featured"
                checked={formData.featured}
                onChange={handleChange}
                className="checkbox checkbox-primary"
              />
              <span className="label-text">Featured article (appears at the top)</span>
            </label>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-300 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost" disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving...
              </>
            ) : isEditing ? (
              'Save Changes'
            ) : (
              'Create Article'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
