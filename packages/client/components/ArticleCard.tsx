'use client';

import Link from 'next/link';

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

interface ArticleCardProps {
  article: Article;
  categoryName: string;
  categoryColor: string;
  onEdit?: () => void;
  featured?: boolean;
}

export default function ArticleCard({
  article,
  categoryName,
  categoryColor,
  onEdit,
  featured = false,
}: ArticleCardProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateSummary = (text: string, maxLength: number = 120) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const badgeColorClass = {
    primary: 'badge-primary',
    secondary: 'badge-secondary',
    accent: 'badge-accent',
    neutral: 'badge-neutral',
    info: 'badge-info',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
  }[categoryColor] || 'badge-primary';

  return (
    <div
      className={`bg-base-100 rounded-lg shadow hover:shadow-lg transition-all duration-300 overflow-hidden group ${
        featured ? 'ring-2 ring-warning ring-offset-2 ring-offset-base-200' : ''
      }`}
    >
      <Link href={`/knowledge-base/${article.slug}`} className="block p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${badgeColorClass} badge-sm`}>{categoryName}</span>
            {article.status === 'Draft' && (
              <span className="badge badge-ghost badge-sm">Draft</span>
            )}
            {featured && (
              <span className="badge badge-warning badge-sm gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Featured
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-base-content group-hover:text-primary transition-colors mb-2 line-clamp-2">
          {article.title}
        </h3>

        {/* Summary */}
        <p className="text-base-content/70 text-sm mb-4 line-clamp-2">
          {truncateSummary(article.summary || article.content)}
        </p>

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {article.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="badge badge-outline badge-xs">
                {tag}
              </span>
            ))}
            {article.tags.length > 3 && (
              <span className="badge badge-ghost badge-xs">+{article.tags.length - 3}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-base-content/50">
          <div className="flex items-center gap-3">
            {article.authorName && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {article.authorName}
              </span>
            )}
            <span>{formatDate(article.createdDate)}</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            {article.viewCount.toLocaleString()}
          </div>
        </div>
      </Link>

      {/* Edit Button */}
      {onEdit && (
        <div className="px-5 pb-4 pt-0">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit();
            }}
            className="btn btn-ghost btn-xs gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            Edit
          </button>
        </div>
      )}
    </div>
  );
}
