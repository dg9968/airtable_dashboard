// components/TrainingVideos.tsx
'use client';

import { useState, useEffect } from 'react';

// Types for YouTube API responses
interface YouTubeThumbnail {
  url: string;
  width: number;
  height: number;
}

interface YouTubeSnippet {
  publishedAt: string;
  channelId: string;
  title: string;
  description: string;
  thumbnails: {
    default: YouTubeThumbnail;
    medium: YouTubeThumbnail;
    high: YouTubeThumbnail;
    standard?: YouTubeThumbnail;
    maxres?: YouTubeThumbnail;
  };
  channelTitle: string;
  categoryId?: string;
  liveBroadcastContent: string;
  defaultLanguage?: string;
  defaultAudioLanguage?: string;
}

interface YouTubeStatistics {
  viewCount: string;
  likeCount: string;
  dislikeCount?: string;
  favoriteCount: string;
  commentCount: string;
}

interface YouTubeContentDetails {
  duration: string;
  dimension: string;
  definition: string;
  caption: string;
  licensedContent: boolean;
  regionRestriction?: {
    allowed?: string[];
    blocked?: string[];
  };
  contentRating: object;
  projection: string;
}

interface YouTubeVideo {
  kind: string;
  etag: string;
  id: string;
  snippet: YouTubeSnippet;
  statistics?: YouTubeStatistics;
  contentDetails?: YouTubeContentDetails;
}

interface YouTubeApiResponse {
  kind: string;
  etag: string;
  items: YouTubeVideo[];
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
}

interface VideoCardProps {
  video: YouTubeVideo;
  onVideoSelect: (video: YouTubeVideo) => void;
}

interface VideoPlayerProps {
  video: YouTubeVideo | null;
  onClose: () => void;
}

// Video Card Component
const VideoCard = ({ video, onVideoSelect }: VideoCardProps) => {
  const formatDuration = (duration: string) => {
    if (!duration) return '';
    
    // Parse ISO 8601 duration format (PT4M13S -> 4:13)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '';
    
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatViewCount = (count: string) => {
    const num = parseInt(count);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M views`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K views`;
    }
    return `${num} views`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div 
      className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer group"
      onClick={() => onVideoSelect(video)}
    >
      <div className="relative">
        <img
          src={video.snippet.thumbnails.high?.url || video.snippet.thumbnails.medium.url}
          alt={video.snippet.title}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {video.contentDetails?.duration && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white px-2 py-1 rounded text-sm">
            {formatDuration(video.contentDetails.duration)}
          </div>
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
          <div className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        <h3 className="text-white font-semibold mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
          {video.snippet.title}
        </h3>
        
        <p className="text-gray-400 text-sm mb-3 line-clamp-2">
          {video.snippet.description}
        </p>
        
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{formatDate(video.snippet.publishedAt)}</span>
          {video.statistics?.viewCount && (
            <span>{formatViewCount(video.statistics.viewCount)}</span>
          )}
        </div>
        
        {video.statistics?.likeCount && (
          <div className="flex items-center mt-2 text-sm text-gray-500">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z"/>
            </svg>
            {parseInt(video.statistics.likeCount).toLocaleString()} likes
          </div>
        )}
      </div>
    </div>
  );
};

// Video Player Modal Component
const VideoPlayer = ({ video, onClose }: VideoPlayerProps) => {
  if (!video) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-semibold text-white truncate pr-4">
            {video.snippet.title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          {/* YouTube Embed */}
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute top-0 left-0 w-full h-full rounded-lg"
              src={`https://www.youtube.com/embed/${video.id}?autoplay=1&rel=0`}
              title={video.snippet.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          
          {/* Video Information */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400">
                Published on {new Date(video.snippet.publishedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
              {video.statistics?.viewCount && (
                <span className="text-gray-400">
                  {parseInt(video.statistics.viewCount).toLocaleString()} views
                </span>
              )}
            </div>
            
            {video.statistics && (
              <div className="flex items-center space-x-6 mb-4 text-sm text-gray-400">
                {video.statistics.likeCount && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z"/>
                    </svg>
                    {parseInt(video.statistics.likeCount).toLocaleString()}
                  </div>
                )}
                {video.statistics.commentCount && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    {parseInt(video.statistics.commentCount).toLocaleString()} comments
                  </div>
                )}
              </div>
            )}
            
            <div className="text-gray-300 leading-relaxed">
              <p className="whitespace-pre-line">{video.snippet.description}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Training Videos Component
export default function TrainingVideos() {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeVideo | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVideos, setFilteredVideos] = useState<YouTubeVideo[]>([]);

  useEffect(() => {
    fetchTrainingVideos();
  }, []);

  useEffect(() => {
    // Filter videos based on search query
    if (searchQuery.trim() === '') {
      setFilteredVideos(videos);
    } else {
      const filtered = videos.filter(video =>
        video.snippet.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        video.snippet.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVideos(filtered);
    }
  }, [searchQuery, videos]);

  const fetchTrainingVideos = async () => {
    try {
      setLoading(true);
      setError(null);

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/youtube-videos`);
      const data = await response.json();
      
      if (data.success) {
        setVideos(data.videos);
      } else {
        throw new Error(data.error || 'Failed to fetch training videos');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch training videos';
      setError(errorMessage);
      console.error('Error fetching training videos:', err);
      
      // Fallback to mock data for demonstration
      setVideos([
        {
          kind: 'youtube#video',
          etag: 'mock-etag-1',
          id: 'dQw4w9WgXcQ',
          snippet: {
            publishedAt: '2024-01-15T10:00:00Z',
            channelId: 'UCMockChannelId',
            title: 'Tax Preparation Fundamentals - Getting Started',
            description: 'Learn the basics of tax preparation in this comprehensive tutorial. We cover essential concepts, forms, and best practices for new tax professionals.',
            thumbnails: {
              default: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg', width: 120, height: 90 },
              medium: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg', width: 320, height: 180 },
              high: { url: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', width: 480, height: 360 }
            },
            channelTitle: 'Tax Pro Training',
            liveBroadcastContent: 'none'
          },
          statistics: {
            viewCount: '15432',
            likeCount: '324',
            favoriteCount: '0',
            commentCount: '45'
          },
          contentDetails: {
            duration: 'PT15M30S',
            dimension: '2d',
            definition: 'hd',
            caption: 'false',
            licensedContent: false,
            contentRating: {},
            projection: 'rectangular'
          }
        },
        {
          kind: 'youtube#video',
          etag: 'mock-etag-2',
          id: 'jNQXAC9IVRw',
          snippet: {
            publishedAt: '2024-02-01T14:30:00Z',
            channelId: 'UCMockChannelId',
            title: 'Advanced Deductions and Credits Strategies',
            description: 'Master complex deduction strategies and tax credits to maximize client savings. This advanced tutorial covers itemized deductions, business expenses, and tax planning techniques.',
            thumbnails: {
              default: { url: 'https://img.youtube.com/vi/jNQXAC9IVRw/default.jpg', width: 120, height: 90 },
              medium: { url: 'https://img.youtube.com/vi/jNQXAC9IVRw/mqdefault.jpg', width: 320, height: 180 },
              high: { url: 'https://img.youtube.com/vi/jNQXAC9IVRw/hqdefault.jpg', width: 480, height: 360 }
            },
            channelTitle: 'Tax Pro Training',
            liveBroadcastContent: 'none'
          },
          statistics: {
            viewCount: '8765',
            likeCount: '198',
            favoriteCount: '0',
            commentCount: '32'
          },
          contentDetails: {
            duration: 'PT22M45S',
            dimension: '2d',
            definition: 'hd',
            caption: 'false',
            licensedContent: false,
            contentRating: {},
            projection: 'rectangular'
          }
        },
        {
          kind: 'youtube#video',
          etag: 'mock-etag-3',
          id: 'QH2-TGUlwu4',
          snippet: {
            publishedAt: '2024-02-15T09:15:00Z',
            channelId: 'UCMockChannelId',
            title: 'Business Tax Returns - LLCs and Corporations',
            description: 'Complete guide to preparing business tax returns for different entity types. Learn about Schedule C, Form 1120, Form 1120S, and partnership returns.',
            thumbnails: {
              default: { url: 'https://img.youtube.com/vi/QH2-TGUlwu4/default.jpg', width: 120, height: 90 },
              medium: { url: 'https://img.youtube.com/vi/QH2-TGUlwu4/mqdefault.jpg', width: 320, height: 180 },
              high: { url: 'https://img.youtube.com/vi/QH2-TGUlwu4/hqdefault.jpg', width: 480, height: 360 }
            },
            channelTitle: 'Tax Pro Training',
            liveBroadcastContent: 'none'
          },
          statistics: {
            viewCount: '12098',
            likeCount: '278',
            favoriteCount: '0',
            commentCount: '56'
          },
          contentDetails: {
            duration: 'PT28M12S',
            dimension: '2d',
            definition: 'hd',
            caption: 'false',
            licensedContent: false,
            contentRating: {},
            projection: 'rectangular'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (video: YouTubeVideo) => {
    setSelectedVideo(video);
  };

  const handleClosePlayer = () => {
    setSelectedVideo(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading training videos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <div className="flex items-center space-x-4">
                <a href="/" className="text-blue-400 hover:text-blue-300 cursor-pointer">
                  ← Back to Main Dashboard
                </a>
              </div>
              <h1 className="text-3xl font-bold text-white mt-2">Training Videos</h1>
              <p className="text-gray-300">
                Learn from our comprehensive tax preparation training videos
              </p>
              
              {error && (
                <div className="mt-2 p-4 bg-red-900/50 border border-red-700 rounded-lg">
                  <p className="text-sm text-red-200">
                    <span className="font-medium">⚠️ Note:</span> {error}
                  </p>
                  <p className="text-sm text-red-300 mt-2">
                    Showing demo videos for display purposes. Configure YouTube API for live data.
                  </p>
                </div>
              )}
            </div>
            <button 
              onClick={fetchTrainingVideos}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Videos
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search training videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <svg
                  className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
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
              </div>
            </div>
            
            <div className="text-sm text-gray-400">
              {filteredVideos.length} of {videos.length} videos
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-blue-900 rounded-lg">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Videos</p>
                <p className="text-2xl font-bold text-white">{videos.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-green-900 rounded-lg">
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Views</p>
                <p className="text-2xl font-bold text-white">
                  {videos.reduce((total, video) => total + (video.statistics ? parseInt(video.statistics.viewCount) : 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-700">
            <div className="flex items-center">
              <div className="p-2 bg-purple-900 rounded-lg">
                <svg className="w-6 h-6 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7.493 18.75c-.425 0-.82-.236-.975-.632A7.48 7.48 0 016 15.125c0-1.75.599-3.358 1.602-4.634.151-.192.373-.309.6-.397.473-.183.89-.514 1.212-.924a9.042 9.042 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558-.107 1.282.725 1.282h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H14.23c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23h-.777zM2.331 10.977a11.969 11.969 0 00-.831 4.398 12 12 0 00.52 3.507c.26.85 1.084 1.368 1.973 1.368H4.9c.445 0 .72-.498.523-.898a8.963 8.963 0 01-.924-3.977c0-1.708.476-3.305 1.302-4.666.245-.403-.028-.959-.5-.959H4.25c-.832 0-1.612.453-1.918 1.227z"/>
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-400">Total Likes</p>
                <p className="text-2xl font-bold text-white">
                  {videos.reduce((total, video) => total + (video.statistics ? parseInt(video.statistics.likeCount) : 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Videos Grid */}
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No videos found</h3>
            <p className="text-gray-400">
              {searchQuery ? 'No videos match your search criteria.' : 'No training videos available at the moment.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-4 text-blue-400 hover:text-blue-300 transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVideos.map((video) => (
              <VideoCard
                key={video.id}
                video={video}
                onVideoSelect={handleVideoSelect}
              />
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-12 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a 
              href="https://www.youtube.com/@YourChannelName" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
            >
              <svg className="w-8 h-8 text-red-500 mr-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              <div>
                <div className="font-medium text-white">Visit Our Channel</div>
                <div className="text-sm text-gray-400">Subscribe for new videos</div>
              </div>
            </a>
            
            <button className="flex items-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
              <svg className="w-8 h-8 text-blue-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div>
                <div className="font-medium text-white">Study Guide</div>
                <div className="text-sm text-gray-400">Download resources</div>
              </div>
            </button>
            
            <button className="flex items-center p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
              <svg className="w-8 h-8 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              <div>
                <div className="font-medium text-white">Certification</div>
                <div className="text-sm text-gray-400">Track progress</div>
              </div>
            </button>
          </div>
        </div>
      </main>

      {/* Video Player Modal */}
      <VideoPlayer video={selectedVideo} onClose={handleClosePlayer} />
    </div>
  );
}