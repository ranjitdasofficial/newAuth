import axios from 'axios';

// Replace with your actual YouTube API key
// const API_KEY = 'AIzaSyAtnbNPZaovJqjO72m56CfYvCMA0WE7pQI';
// const PLAYLIST_ID = 'PL1QH9gyQXfgs7foRxIbIH8wmJyDh5QzAm';
const BASE_URL = 'https://www.googleapis.com/youtube/v3/playlistItems';
const VIDEO_DETAILS_URL = 'https://www.googleapis.com/youtube/v3/videos';

export async function fetchAllPlaylistItems(playlistId:string, apiKey:string) {
  let allItems = [];
  let nextPageToken = null; // For pagination, initially no nextPageToken

  try {
    while (true) {
      // Prepare parameters for the API request to fetch playlist items
      const params = {
        part: 'snippet',  // We need video details from the snippet
        playlistId: playlistId,
        maxResults: 50,   // Max items per request (50 is the max allowed)
        key: apiKey,
        pageToken: nextPageToken // For pagination
      };

      // Make the API request to fetch playlist items
      const response = await axios.get(BASE_URL, { params });
      
      // Add the items from this page to the list
      allItems = [...allItems, ...response.data.items];

      // Check if there's a nextPageToken
      nextPageToken = response.data.nextPageToken;

      // If there's no nextPageToken, stop the loop (no more pages)
      if (!nextPageToken) {
        break;
      }
    }

    // Fetch video details (duration, etc.) for each item
    const detailedItems = await Promise.all(allItems.map(async (item) => {
      const videoId = item.snippet.resourceId.videoId;

      // Fetch video details (including duration)
      const videoDetailsResponse = await axios.get(VIDEO_DETAILS_URL, {
        params: {
          part: 'contentDetails',
          id: videoId,
          key: apiKey
        }
      });

      const duration = videoDetailsResponse.data.items[0].contentDetails.duration; // Duration in ISO 8601 format
      const formattedDuration = formatDuration(duration); // Format the duration

      // Return an object with the desired properties
      return {
        title: item.snippet.title,
        videoId: videoId,
        thumbnail: item.snippet.thumbnails.standard.url,
        duration: formattedDuration
      };
    }));

    return detailedItems;
  } catch (error) {
    console.error('Error fetching data from YouTube API:', error);
  }
}

// Helper function to convert ISO 8601 duration to a more readable format (HH:MM:SS)
function formatDuration(isoDuration) {
  const regex = /^PT(\d+H)?(\d+M)?(\d+S)?$/;
  const match = isoDuration.match(regex);
  if (!match) return '00:00:00';

  const hours = match[1] ? match[1].replace('H', '') : '00';
  const minutes = match[2] ? match[2].replace('M', '') : '00';
  const seconds = match[3] ? match[3].replace('S', '') : '00';

  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
}

// Fetch all items and log the results
// export async function fetchAllPlaylistItems(PLAYLIST_ID, API_KEY){
//     .then((items) => {
//         console.log(`Fetched ${items.length} items.`);
    
//         // Print the details of each video
//         items.forEach(item => {
//           console.log(`Title: ${item.title}`);
//           console.log(`Video ID: ${item.videoId}`);
//           console.log(`Thumbnail URL: ${item.thumbnail}`);
//           console.log(`Duration: ${item.duration}`);
//           console.log('---');
//         });
//       })
//       .catch((err) => {
//         console.error('Error:', err);
//       });
// }
  
