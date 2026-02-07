'use client';

import { useState, useEffect } from 'react';

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

interface CategoryManagerProps {
  categories: Category[];
  onClose: () => void;
  onSave: () => void;
}

const ICON_OPTIONS = [
  { value: 'scale', label: 'Scale (Tax/Legal)' },
  { value: 'book', label: 'Book (General)' },
  { value: 'form', label: 'Document (Forms)' },
  { value: 'organization', label: 'Building (Organization)' },
  { value: 'folder', label: 'Folder (General)' },
  { value: 'calculator', label: 'Calculator (Financial)' },
  { value: 'calendar', label: 'Calendar (Deadlines)' },
  { value: 'users', label: 'Users (Clients/Team)' },
  { value: 'clipboard', label: 'Clipboard (Checklists)' },
  { value: 'lightbulb', label: 'Lightbulb (Tips)' },
];

const COLOR_OPTIONS = [
  { value: 'primary', label: 'Primary (Blue)' },
  { value: 'secondary', label: 'Secondary (Purple)' },
  { value: 'accent', label: 'Accent (Teal)' },
  { value: 'info', label: 'Info (Cyan)' },
  { value: 'success', label: 'Success (Green)' },
  { value: 'warning', label: 'Warning (Yellow)' },
  { value: 'error', label: 'Error (Red)' },
  { value: 'neutral', label: 'Neutral (Gray)' },
];

export default function CategoryManager({ categories, onClose, onSave }: CategoryManagerProps) {
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'book',
    color: 'primary',
    sortOrder: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: 'book',
      color: 'primary',
      sortOrder: localCategories.length + 1,
    });
    setEditingCategory(null);
    setIsCreating(false);
    setError(null);
  };

  const handleCreate = () => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: 'book',
      color: 'primary',
      sortOrder: localCategories.length + 1,
    });
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsCreating(false);
    setFormData({
      name: category.name,
      description: category.description,
      icon: category.icon,
      color: category.color,
      sortOrder: category.sortOrder,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'sortOrder' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const url = editingCategory
        ? `${apiUrl}/api/knowledge-categories/${editingCategory.id}`
        : `${apiUrl}/api/knowledge-categories`;

      const response = await fetch(url, {
        method: editingCategory ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        resetForm();
        onSave();
      } else {
        throw new Error(data.error || 'Failed to save category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if (!confirm(`Are you sure you want to deactivate "${category.name}"?`)) {
      return;
    }

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/knowledge-categories/${category.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        onSave();
      } else {
        throw new Error(data.error || 'Failed to delete category');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  const getColorBadgeClass = (color: string) => {
    return {
      primary: 'badge-primary',
      secondary: 'badge-secondary',
      accent: 'badge-accent',
      info: 'badge-info',
      success: 'badge-success',
      warning: 'badge-warning',
      error: 'badge-error',
      neutral: 'badge-neutral',
    }[color] || 'badge-primary';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-base-300 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-base-content">Manage Categories</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
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

          {/* Category List */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Categories</h3>
              <button onClick={handleCreate} className="btn btn-primary btn-sm gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Category
              </button>
            </div>

            {localCategories.length === 0 ? (
              <div className="text-center py-8 text-base-content/50">
                <p>No categories yet. Create your first category to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localCategories.map((category) => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      editingCategory?.id === category.id
                        ? 'border-primary bg-primary/5'
                        : 'border-base-300 hover:bg-base-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`badge ${getColorBadgeClass(category.color)}`}>
                        {category.name}
                      </span>
                      <span className="text-sm text-base-content/50">
                        {category.articleCount} articles
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(category)}
                        className="btn btn-ghost btn-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category)}
                        className="btn btn-ghost btn-xs text-error"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Create/Edit Form */}
          {(isCreating || editingCategory) && (
            <div className="border-t border-base-300 pt-6">
              <h3 className="text-lg font-medium mb-4">
                {editingCategory ? 'Edit Category' : 'New Category'}
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Name *</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Category name"
                      className="input input-bordered w-full"
                      required
                    />
                  </div>

                  {/* Sort Order */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Sort Order</span>
                    </label>
                    <input
                      type="number"
                      name="sortOrder"
                      value={formData.sortOrder}
                      onChange={handleChange}
                      className="input input-bordered w-full"
                      min="0"
                    />
                  </div>

                  {/* Icon */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Icon</span>
                    </label>
                    <select
                      name="icon"
                      value={formData.icon}
                      onChange={handleChange}
                      className="select select-bordered w-full"
                    >
                      {ICON_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="label">
                      <span className="label-text font-medium">Color</span>
                    </label>
                    <select
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      className="select select-bordered w-full"
                    >
                      {COLOR_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Description</span>
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Category description"
                    className="textarea textarea-bordered w-full"
                    rows={2}
                  />
                </div>

                {/* Preview */}
                <div>
                  <label className="label">
                    <span className="label-text font-medium">Preview</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${getColorBadgeClass(formData.color)}`}>
                      {formData.name || 'Category Name'}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={resetForm} className="btn btn-ghost">
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? (
                      <>
                        <span className="loading loading-spinner loading-sm"></span>
                        Saving...
                      </>
                    ) : editingCategory ? (
                      'Save Changes'
                    ) : (
                      'Create Category'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-base-300 flex justify-end">
          <button onClick={onClose} className="btn btn-ghost">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
