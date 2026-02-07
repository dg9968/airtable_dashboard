'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import ArticleCard from './ArticleCard';
import ArticleEditor from './ArticleEditor';
import CategoryManager from './CategoryManager';

// Types
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

// Category icon component
const CategoryIcon = ({ icon, className = 'w-5 h-5' }: { icon: string; className?: string }) => {
  const icons: Record<string, React.ReactElement> = {
    scale: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
      </svg>
    ),
    book: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    form: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    organization: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    folder: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    calculator: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
    calendar: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    users: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    clipboard: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    lightbulb: (
      <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  };

  return icons[icon] || icons.book;
};

export default function KnowledgeBase() {
  const { data: session } = useSession();
  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const userRole = (session?.user as any)?.role;
  const canEdit = ['staff', 'admin'].includes(userRole);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    // Debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchArticles();
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([fetchCategories(), fetchArticles()]);
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/knowledge-categories`);
      const data = await response.json();

      if (data.success) {
        setCategories(data.data);
        if (data.setupRequired) {
          setSetupRequired(true);
        }
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchArticles = async () => {
    try {
      setError(null);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (selectedCategory) params.append('category', selectedCategory);
      // Show all statuses for staff/admin, only Published for others
      params.append('status', canEdit ? 'all' : 'Published');

      const response = await fetch(`${apiUrl}/api/knowledge-articles?${params}`);
      const data = await response.json();

      if (data.success) {
        setArticles(data.data);
        if (data.setupRequired) {
          setSetupRequired(true);
        }
      } else {
        throw new Error(data.error || 'Failed to fetch articles');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch articles';
      setError(errorMessage);
    }
  };

  const handleCreateArticle = () => {
    setEditingArticle(null);
    setShowEditor(true);
  };

  const handleEditArticle = (article: Article) => {
    setEditingArticle(article);
    setShowEditor(true);
  };

  const handleEditorClose = () => {
    setShowEditor(false);
    setEditingArticle(null);
  };

  const handleArticleSaved = () => {
    setShowEditor(false);
    setEditingArticle(null);
    fetchArticles();
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Uncategorized';
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || 'Uncategorized';
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return 'neutral';
    const category = categories.find((c) => c.id === categoryId);
    return category?.color || 'primary';
  };

  // Calculate article count per category from fetched articles
  const getCategoryArticleCount = (categoryId: string) => {
    return articles.filter((a) => a.categoryId === categoryId).length;
  };

  // Separate featured and regular articles
  const featuredArticles = articles.filter((a) => a.featured);
  const regularArticles = articles.filter((a) => !a.featured);

  // Calculate stats
  const totalArticles = articles.length;
  const totalViews = articles.reduce((sum, a) => sum + a.viewCount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      {/* Header */}
      <div className="bg-base-100 shadow-lg">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-base-content">Knowledge Base</h1>
              <p className="text-base-content/70 mt-1">
                Find answers, tutorials, and documentation
              </p>
            </div>

            {canEdit && (
              <button
                onClick={handleCreateArticle}
                className="btn btn-primary"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Article
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="mt-6">
            <div className="relative max-w-2xl">
              <input
                type="text"
                placeholder="Search articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered w-full pl-12"
              />
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-base-content/50 hover:text-base-content"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Setup Required Warning */}
      {setupRequired && canEdit && (
        <div className="container mx-auto px-4 py-4">
          <div className="alert alert-warning">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <h3 className="font-bold">Setup Required</h3>
              <p>Please create the Knowledge Categories and Knowledge Articles tables in Airtable.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar - Categories */}
          <div className="lg:w-64 flex-shrink-0">
            <div className="bg-base-100 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-base-content">Categories</h2>
                {canEdit && (
                  <button
                    onClick={() => setShowCategoryManager(true)}
                    className="btn btn-ghost btn-xs"
                    title="Manage Categories"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                <li>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      selectedCategory === null
                        ? 'bg-primary text-primary-content'
                        : 'hover:bg-base-200'
                    }`}
                  >
                    <CategoryIcon icon="folder" />
                    <span>All Articles</span>
                    <span className="ml-auto text-sm opacity-70">{totalArticles}</span>
                  </button>
                </li>
                {categories.map((category) => (
                  <li key={category.id}>
                    <button
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-primary text-primary-content'
                          : 'hover:bg-base-200'
                      }`}
                    >
                      <CategoryIcon icon={category.icon} />
                      <span>{category.name}</span>
                      <span className="ml-auto text-sm opacity-70">{getCategoryArticleCount(category.id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Stats Card */}
            <div className="bg-base-100 rounded-lg shadow p-4 mt-4">
              <h2 className="text-lg font-semibold text-base-content mb-4">Stats</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-base-content/70">Total Articles</span>
                  <span className="font-semibold">{totalArticles}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/70">Total Views</span>
                  <span className="font-semibold">{totalViews.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/70">Categories</span>
                  <span className="font-semibold">{categories.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1">
            {error && (
              <div className="alert alert-error mb-6">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {/* Featured Articles */}
            {featuredArticles.length > 0 && !searchQuery && !selectedCategory && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-base-content mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                  Featured Articles
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {featuredArticles.map((article) => (
                    <ArticleCard
                      key={article.id}
                      article={article}
                      categoryName={getCategoryName(article.categoryId)}
                      categoryColor={getCategoryColor(article.categoryId)}
                      onEdit={canEdit ? () => handleEditArticle(article) : undefined}
                      featured
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Regular Articles */}
            <div>
              <h2 className="text-xl font-semibold text-base-content mb-4">
                {searchQuery
                  ? `Search Results (${regularArticles.length + featuredArticles.length})`
                  : selectedCategory
                  ? getCategoryName(selectedCategory)
                  : 'All Articles'}
              </h2>

              {regularArticles.length === 0 && featuredArticles.length === 0 ? (
                <div className="bg-base-100 rounded-lg shadow p-12 text-center">
                  <svg
                    className="w-16 h-16 mx-auto text-base-content/30 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-base-content mb-2">No articles found</h3>
                  <p className="text-base-content/70 mb-4">
                    {searchQuery
                      ? 'Try a different search term.'
                      : selectedCategory
                      ? 'No articles in this category yet.'
                      : 'Get started by creating your first article.'}
                  </p>
                  {canEdit && !searchQuery && (
                    <button onClick={handleCreateArticle} className="btn btn-primary">
                      Create Article
                    </button>
                  )}
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="btn btn-ghost">
                      Clear Search
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {(searchQuery ? [...featuredArticles, ...regularArticles] : regularArticles).map(
                    (article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        categoryName={getCategoryName(article.categoryId)}
                        categoryColor={getCategoryColor(article.categoryId)}
                        onEdit={canEdit ? () => handleEditArticle(article) : undefined}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Article Editor Modal */}
      {showEditor && (
        <ArticleEditor
          article={editingArticle}
          categories={categories}
          onClose={handleEditorClose}
          onSave={handleArticleSaved}
        />
      )}

      {/* Category Manager Modal */}
      {showCategoryManager && (
        <CategoryManager
          categories={categories}
          onClose={() => setShowCategoryManager(false)}
          onSave={() => {
            fetchCategories();
          }}
        />
      )}
    </div>
  );
}
