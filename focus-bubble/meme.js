// meme.js — Background-safe logic (NO DOM APIs)
// Fallback memes using data URIs that will always work
// meme.js — Enhanced with more fallback options
const fallbackMemes = [
  {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%236366f1'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EBack to work!%3C/text%3E%3C/svg%3E",
    caption: "One does not simply browse distracting sites during focus time",
    animated: false
  },
  {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%234f46e5'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EFocus Mode Activated!%3C/text%3E%3C/svg%3E",
    caption: "Your future self will thank you for staying focused now",
    animated: false
  },
  {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23ef4444'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EDistraction Blocked!%3C/text%3E%3C/svg%3E",
    caption: "Distraction? Not today!",
    animated: false
  },
  {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%2310b981'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EStay Productive!%3C/text%3E%3C/svg%3E",
    caption: "Productivity is a journey, not a destination",
    animated: false
  },
  {
    url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%23f59e0b'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EDeep Work Zone%3C/text%3E%3C/svg%3E",
    caption: "This is your deep work time - no distractions allowed",
    animated: false
  }
];

// Rest of the file remains the same...

// Try to load extension memes, but with better fallback mechanism
function getMemes() {
  try {
    return [
      {
        url: chrome.runtime.getURL("memes/procrastination.gif"),
        caption: "One does not simply browse YouTube during focus time",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/mindful.gif"),
        caption: "Time to be mindful of your focus",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/cat-working.gif"),
        caption: "Back to work! Your future self will thank you",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/nope.gif"),
        caption: "Distraction? Not today!",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/productivity.gif"),
        caption: "Your productivity is more important than this site",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/focus-mode.gif"),
        caption: "Focus mode: ACTIVATED!",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/concentrate.gif"),
        caption: "C'mon, concentrate!",
        animated: true
      },
      {
        url: chrome.runtime.getURL("memes/work-from-home.gif"),
        caption: "WFH reality check",
        animated: true
      }
    ];
  } catch (error) {
    console.warn("Error loading memes, using fallbacks:", error);
    return [...fallbackMemes];
  }
}

// Cache the memes for better performance
let cachedMemes = null;

// Random meme fetch — background-safe (no validation here)
export function getRandomMeme() {
  try {
    if (!cachedMemes) {
      cachedMemes = getMemes();
    }
    
    const randomIndex = Math.floor(Math.random() * cachedMemes.length);
    return Promise.resolve(cachedMemes[randomIndex]);
  } catch (error) {
    console.error("Error getting random meme:", error);
    return Promise.reject(error);
  }
}

// Synchronous fallback meme
export function getRandomMemeSync() {
  const fallbackIndex = Math.floor(Math.random() * fallbackMemes.length);
  return fallbackMemes[fallbackIndex];
}

// Handle messages from popup/content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getRandomMeme") {
    getRandomMeme()
      .then(meme => sendResponse({ meme }))
      .catch(error => {
        console.error("Failed to get meme:", error);
        sendResponse({ meme: getRandomMemeSync() });
      });
    return true; // keep message channel open
  }
});
