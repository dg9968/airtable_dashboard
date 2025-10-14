/**
 * YouTube Videos Routes
 */

import { Hono } from 'hono';

const app = new Hono();

interface YouTubeVideo {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    categoryId?: string;
    liveBroadcastContent: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
  };
  statistics?: {
    viewCount: string;
    likeCount: string;
    dislikeCount?: string;
    favoriteCount: string;
    commentCount: string;
  };
  contentDetails?: {
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
  };
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

async function fetchChannelVideos(channelId: string, maxResults: number = 50): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  try {
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${apiKey}`
    );

    if (!channelResponse.ok) {
      throw new Error(`Failed to fetch channel data: ${channelResponse.statusText}`);
    }

    const channelData = await channelResponse.json();

    if (!channelData.items || channelData.items.length === 0) {
      throw new Error('Channel not found');
    }

    const uploadsPlaylistId = channelData.items[0].contentDetails.relatedPlaylists.uploads;

    const playlistResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}&key=${apiKey}`
    );

    if (!playlistResponse.ok) {
      throw new Error(`Failed to fetch playlist items: ${playlistResponse.statusText}`);
    }

    const playlistData = await playlistResponse.json();

    if (!playlistData.items || playlistData.items.length === 0) {
      return [];
    }

    const videoIds = playlistData.items.map((item: any) => item.snippet.resourceId.videoId).join(',');

    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );

    if (!videosResponse.ok) {
      throw new Error(`Failed to fetch video details: ${videosResponse.statusText}`);
    }

    const videosData: YouTubeApiResponse = await videosResponse.json();

    return videosData.items || [];

  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    throw error;
  }
}

async function searchVideos(query: string, channelId?: string, maxResults: number = 25): Promise<YouTubeVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new Error('YouTube API key not configured');
  }

  try {
    let searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${apiKey}`;

    if (channelId) {
      searchUrl += `&channelId=${channelId}`;
    }

    const searchResponse = await fetch(searchUrl);

    if (!searchResponse.ok) {
      throw new Error(`Failed to search videos: ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.items || searchData.items.length === 0) {
      return [];
    }

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');

    const videosResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${apiKey}`
    );

    if (!videosResponse.ok) {
      throw new Error(`Failed to fetch video details: ${videosResponse.statusText}`);
    }

    const videosData: YouTubeApiResponse = await videosResponse.json();

    return videosData.items || [];

  } catch (error) {
    console.error('Error searching YouTube videos:', error);
    throw error;
  }
}

/**
 * GET /api/youtube-videos?channelId=xxx&query=xxx&maxResults=50
 * Fetch YouTube videos from a channel, search query, or Airtable fallback
 */
app.get('/', async (c) => {
  try {
    const channelId = c.req.query('channelId') || process.env.YOUTUBE_CHANNEL_ID;
    const query = c.req.query('query') || process.env.YOUTUBE_SEARCH_QUERY;
    const maxResults = parseInt(c.req.query('maxResults') || '50');

    // If YouTube API is configured, use it
    if (process.env.YOUTUBE_API_KEY && (channelId || query)) {
      let videos: YouTubeVideo[] = [];

      if (query) {
        videos = await searchVideos(query, channelId, maxResults);
      } else if (channelId) {
        videos = await fetchChannelVideos(channelId, maxResults);
      }

      videos.sort((a, b) => new Date(b.snippet.publishedAt).getTime() - new Date(a.snippet.publishedAt).getTime());

      const stats = {
        totalVideos: videos.length,
        totalViews: videos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.viewCount) : 0), 0),
        totalLikes: videos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.likeCount) : 0), 0),
        totalComments: videos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.commentCount) : 0), 0),
        lastUpdated: new Date().toISOString()
      };

      return c.json({
        success: true,
        videos,
        stats,
        query: query || null,
        channelId: channelId || null,
        source: 'youtube-api'
      });
    }

    // Fallback to demo videos if YouTube API is not configured
    console.log('YouTube API not configured, returning demo videos');
    const demoVideos: YouTubeVideo[] = [
      {
        kind: 'youtube#video',
        etag: 'demo-1',
        id: 'dQw4w9WgXcQ',
        snippet: {
          publishedAt: '2024-01-15T10:00:00Z',
          channelId: 'UCDemo',
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
        etag: 'demo-2',
        id: 'jNQXAC9IVRw',
        snippet: {
          publishedAt: '2024-02-01T14:30:00Z',
          channelId: 'UCDemo',
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
        etag: 'demo-3',
        id: 'QH2-TGUlwu4',
        snippet: {
          publishedAt: '2024-02-15T09:15:00Z',
          channelId: 'UCDemo',
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
    ];

    const stats = {
      totalVideos: demoVideos.length,
      totalViews: demoVideos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.viewCount) : 0), 0),
      totalLikes: demoVideos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.likeCount) : 0), 0),
      totalComments: demoVideos.reduce((sum, video) => sum + (video.statistics ? parseInt(video.statistics.commentCount) : 0), 0),
      lastUpdated: new Date().toISOString()
    };

    return c.json({
      success: true,
      videos: demoVideos,
      stats,
      source: 'demo',
      message: 'Demo videos shown. Configure YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID or YOUTUBE_SEARCH_QUERY in .env for live data.'
    });

  } catch (error) {
    console.error('Error in YouTube API route:', error);

    let errorMessage = 'Failed to fetch YouTube videos';
    let suggestion = 'Please check your YouTube API configuration';

    if (error instanceof Error) {
      errorMessage = error.message;

      if (error.message.includes('API key')) {
        suggestion = 'Set YOUTUBE_API_KEY in your environment variables. Get an API key from Google Cloud Console.';
      } else if (error.message.includes('Channel not found')) {
        suggestion = 'Check that your YOUTUBE_CHANNEL_ID is correct and the channel exists.';
      } else if (error.message.includes('quota')) {
        suggestion = 'YouTube API quota exceeded. Try again later or increase your quota limits.';
      }
    }

    return c.json(
      {
        success: false,
        error: errorMessage,
        suggestion
      },
      500
    );
  }
});

export default app;
