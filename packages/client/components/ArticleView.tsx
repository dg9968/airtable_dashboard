'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ArticleEditor from './ArticleEditor';

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

interface ArticleViewProps {
  slug: string;
}

// Simple Markdown renderer using regex replacements
function renderMarkdown(content: string): string {
  if (!content) return '';

  let html = content;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-xl font-semibold mt-8 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Code blocks (fenced)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre class="bg-base-300 rounded-lg p-4 my-4 overflow-x-auto"><code class="text-sm">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="bg-base-300 px-1 py-0.5 rounded text-sm">$1</code>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // Unordered lists
  html = html.replace(/^\s*[-*]\s+(.*)$/gim, '<li class="ml-4">$1</li>');
  html = html.replace(/(<li.*<\/li>\n?)+/g, '<ul class="list-disc list-inside my-4">$&</ul>');

  // Ordered lists
  html = html.replace(/^\s*\d+\.\s+(.*)$/gim, '<li class="ml-4">$1</li>');

  // Horizontal rule
  html = html.replace(/^---$/gim, '<hr class="my-8 border-base-300">');

  // Blockquotes
  html = html.replace(
    /^&gt;\s*(.*)$/gim,
    '<blockquote class="border-l-4 border-primary pl-4 my-4 italic text-base-content/80">$1</blockquote>'
  );

  // Paragraphs - wrap text blocks
  html = html
    .split('\n\n')
    .map((block) => {
      if (
        block.startsWith('<h') ||
        block.startsWith('<ul') ||
        block.startsWith('<ol') ||
        block.startsWith('<pre') ||
        block.startsWith('<blockquote') ||
        block.startsWith('<hr')
      ) {
        return block;
      }
      if (block.trim()) {
        return `<p class="my-4 leading-relaxed">${block.replace(/\n/g, '<br>')}</p>`;
      }
      return '';
    })
    .join('');

  return html;
}

export default function ArticleView({ slug }: ArticleViewProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const userRole = (session?.user as any)?.role;
  const canEdit = ['staff', 'admin'].includes(userRole);

  useEffect(() => {
    fetchArticle();
    fetchCategories();
  }, [slug]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const response = await fetch(`${apiUrl}/api/knowledge-articles/slug/${slug}`);
      const data = await response.json();

      if (data.success) {
        setArticle(data.data);
        // Track view
        trackView(data.data.id);
      } else {
        throw new Error(data.error || 'Article not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load article');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/knowledge-categories`);
      const data = await response.json();
      if (data.success) {
        setCategories(data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const trackView = async (articleId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/api/knowledge-articles/${articleId}/view`, {
        method: 'POST',
      });
    } catch (err) {
      console.error('Error tracking view:', err);
    }
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleEdit = () => {
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
  };

  const handleArticleSaved = () => {
    setShowEditor(false);
    fetchArticle();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-base-200">
        <div className="container mx-auto px-4 py-12">
          <div className="bg-base-100 rounded-lg shadow p-12 text-center max-w-2xl mx-auto">
            <svg
              className="w-16 h-16 mx-auto text-error mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h1 className="text-2xl font-bold text-base-content mb-2">Article Not Found</h1>
            <p className="text-base-content/70 mb-6">{error || 'The article you are looking for does not exist.'}</p>
            <Link href="/knowledge-base" className="btn btn-primary">
              Back to Knowledge Base
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Breadcrumb */}
      <div className="bg-base-100 border-b border-base-300">
        <div className="container mx-auto px-4 py-3">
          <div className="text-sm breadcrumbs">
            <ul>
              <li>
                <Link href="/knowledge-base" className="text-primary hover:underline">
                  Knowledge Base
                </Link>
              </li>
              <li>
                <span className="text-base-content/70">{getCategoryName(article.categoryId)}</span>
              </li>
              <li>
                <span className="truncate max-w-xs">{article.title}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Article Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-base-100 rounded-lg shadow-lg overflow-hidden">
            {/* Article Header */}
            <div className="p-6 md:p-8 border-b border-base-300">
              {/* Badges */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="badge badge-primary">{getCategoryName(article.categoryId)}</span>
                {article.status === 'Draft' && <span className="badge badge-warning">Draft</span>}
                {article.featured && (
                  <span className="badge badge-warning gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                    Featured
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold text-base-content mb-4">{article.title}</h1>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-base-content/60">
                {article.authorName && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <span>{article.authorName}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span>{formatDate(article.createdDate)}</span>
                </div>
                <div className="flex items-center gap-1">
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
                  <span>{article.viewCount.toLocaleString()} views</span>
                </div>
              </div>

              {/* Edit Button */}
              {canEdit && (
                <div className="mt-4">
                  <button onClick={handleEdit} className="btn btn-outline btn-sm gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit Article
                  </button>
                </div>
              )}
            </div>

            {/* Article Body */}
            <div className="p-6 md:p-8">
              {/* Summary */}
              {article.summary && (
                <div className="bg-base-200 rounded-lg p-4 mb-6 text-base-content/80 italic">
                  {article.summary}
                </div>
              )}

              {/* Content */}
              <div
                className="prose prose-base max-w-none text-base-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(article.content) }}
              />

              {/* Tags */}
              {article.tags && article.tags.length > 0 && (
                <div className="mt-8 pt-6 border-t border-base-300">
                  <h3 className="text-sm font-semibold text-base-content/70 mb-3">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {article.tags.map((tag, index) => (
                      <span key={index} className="badge badge-outline">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-6">
            <Link href="/knowledge-base" className="btn btn-ghost gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Knowledge Base
            </Link>
          </div>
        </div>
      </div>

      {/* Article Editor Modal */}
      {showEditor && (
        <ArticleEditor
          article={article}
          categories={categories}
          onClose={handleEditorClose}
          onSave={handleArticleSaved}
        />
      )}
    </div>
  );
}
