// background.js
import { getRandomMeme, getRandomMemeSync } from './meme.js';

let focusState = {
  isActive: false,
  startTime: null,
  duration: 0,
  blockedSites: [],
  streaks: 0,
  totalFocusTime: 0,
  lastCompletedSession: null
};

let focusTimerId = null;

function updateBadge() {
  try {
    if (focusState.isActive) {
      chrome.action.setBadgeText({ text: "ON" });
      chrome.action.setBadgeBackgroundColor({ color: "#6366f1" });
    } else {
      chrome.action.setBadgeText({ text: "" });
    }
  } catch (error) {
    console.error("Failed to update badge:", error);
  }
}

// Load saved state when extension starts
chrome.storage.local.get(['focusState'], (result) => {
  if (result.focusState) {
    focusState = result.focusState;
    updateBadge();
    
    if (focusState.isActive && focusState.startTime) {
      const elapsedTime = Math.floor((Date.now() - focusState.startTime) / 1000);
      if (elapsedTime >= focusState.duration) {
        completeSession();
      } else {
        const remainingTime = focusState.duration - elapsedTime;
        startTimer(remainingTime);
        updateBadge();
      }
    }
  }
});

// Monitor tab updates to check for blocked sites
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && /^http/.test(tab.url)) {
      // Only inject on http/https pages
      chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
      }).catch(err => console.error("Script injection failed:", err.message));
  }
});


function checkIfSiteIsBlocked(url, tabId) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    for (const site of focusState.blockedSites) {
      if (hostname.includes(site)) {
        chrome.tabs.sendMessage(tabId, { action: "showMemeOverlay" }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn("Content script not ready:", chrome.runtime.lastError.message);
            injectOverlayDirectly(tabId).catch(err => console.error("Overlay injection failed:", err));
          }
        });
        return true;
      }
    }
  } catch (e) {
    console.error("Invalid URL:", url, e);
  }
  return false;
}

async function injectOverlayDirectly(tabId) {
  let meme;
  try {
    meme = await getRandomMeme().catch(() => getRandomMemeSync());
  } catch (e) {
    console.error("Failed to get meme:", e);
    meme = getRandomMemeSync();
  }
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (memeData) => {
        // Create overlay directly in the page
        const overlay = document.createElement('div');
        overlay.id = 'focus-bubble-overlay';
        overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background-color: rgba(0, 0, 0, 0.9);
          z-index: 9999999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: white;
          opacity: 0;
          transition: opacity 0.5s ease;
        `;
        
        // Create meme container
        const container = document.createElement('div');
        container.style.cssText = `
          max-width: 600px;
          text-align: center;
          transform: scale(0.8);
          opacity: 0;
          transition: transform 0.5s ease, opacity 0.5s ease;
        `;
        
        // Create image element
        const img = document.createElement('img');
        img.src = memeData.url;
        img.style.cssText = `
          max-width: 100%;
          display: block;
          ${memeData.animated ? '' : 'border-radius: 12px;'}
        `;
        
        // Create meme element wrapper
        const memeElement = document.createElement('div');
        memeElement.style.cssText = `
          margin-bottom: 20px;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
        `;
        memeElement.appendChild(img);
        
        // Create caption
        const caption = document.createElement('h2');
        caption.id = 'focus-bubble-caption';
        caption.style.cssText = `
          font-size: 24px;
          font-weight: 600;
          margin: 16px 0;
          opacity: 0.95;
          color: white;
          text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.5);
          background-color: rgba(0, 0, 0, 0.5);
          padding: 10px;
          border-radius: 5px;
        `;
        caption.innerText = memeData.caption;
        
        // Create close button
        const button = document.createElement('button');
        button.id = 'focus-bubble-close-btn';
        button.innerText = 'Back to Focus';
        button.style.cssText = `
          margin-top: 24px;
          padding: 12px 24px;
          background-color: #6366f1;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        `;
        
        // Add button event listener
        button.addEventListener('mouseenter', () => {
          button.style.backgroundColor = '#4f46e5';
        });
        
        button.addEventListener('mouseleave', () => {
          button.style.backgroundColor = '#6366f1';
        });
        
        button.addEventListener('click', () => {
          overlay.style.opacity = '0';
          setTimeout(() => {
            if (document.body.contains(overlay)) {
              document.body.removeChild(overlay);
            }
          }, 600);
        });
        
        // Assemble overlay
        container.appendChild(memeElement);
        container.appendChild(caption);
        container.appendChild(button);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        // Animate in
        setTimeout(() => {
          overlay.style.opacity = '1';
          setTimeout(() => {
            container.style.transform = 'scale(1)';
            container.style.opacity = '1';
          }, 100);
        }, 50);
      },
      args: [meme]
    });
  } catch (error) {
    console.error("Failed to inject overlay:", error);
  }
}

function startFocusSession(duration, sites) {
  focusState = {
    ...focusState,
    isActive: true,
    startTime: Date.now(),
    duration: duration,
    blockedSites: sites
  };
  
  chrome.storage.local.set({ focusState }, () => {
    updateBadge();
    
    if (focusTimerId) {
      clearTimeout(focusTimerId);
    }
    startTimer(duration);

    // Check all open tabs for blocked sites
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url) {
          checkIfSiteIsBlocked(tab.url, tab.id);
        }
      });
    });
    
    // Notify other parts of the extension
    try {
      chrome.runtime.sendMessage({ 
        action: "focusSessionStarted", 
        data: { 
          duration: duration,
          sites: sites 
        }
      });
    } catch (error) {
      console.error("Error sending focusSessionStarted message:", error);
    }
  });
}

function startTimer(seconds) {
  if (focusTimerId) {
    clearTimeout(focusTimerId);
  }
  
  focusTimerId = setTimeout(() => {
    if (focusState.isActive) {
      completeSession();
    }
  }, seconds * 1000);
}
// Update the completeSession function in background.js
async function completeSession() {
  focusState.streaks += 1;
  focusState.totalFocusTime += focusState.duration;
  focusState.lastCompletedSession = Date.now();
  focusState.isActive = false;
  
  // Update badge immediately
  updateBadge();
  
  // Save state first
  await chrome.storage.local.set({ focusState });
  
  try {
    // Send message to popup first
    chrome.runtime.sendMessage({ 
      action: "focusSessionCompleted", 
      data: focusState 
    });
    
    // Then show notification
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon48.png'),
      title: 'Focus Session Completed!',
      message: `Great job! You focused for ${Math.floor(focusState.duration/60)} minutes.`,
      priority: 2
    });
    
  } catch (error) {
    console.error("Notification error:", error);
    // Fallback: Try again with simpler notification
    try {
      await chrome.notifications.create({
        type: 'basic',
        title: 'Focus Session Completed',
        message: 'Great job staying focused!',
        iconUrl: 'icon48.png',
        priority: 1
      });
    } catch (e) {
      console.error("Fallback notification failed:", e);
    }
  }
  
  // Clear the timer
  if (focusTimerId) {
    clearTimeout(focusTimerId);
    focusTimerId = null;
  }
}

function cancelFocusSession() {
  focusState.isActive = false;
  updateBadge();
  
  chrome.storage.local.set({ focusState }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving focus state:", chrome.runtime.lastError);
    }
  });
  
  try {
    chrome.runtime.sendMessage({ action: "focusSessionCanceled" });
  } catch (error) {
    console.error("Error sending focusSessionCanceled message:", error);
  }
  
  if (focusTimerId) {
    clearTimeout(focusTimerId);
    focusTimerId = null;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === "startFocusSession") {
      startFocusSession(message.data.duration, message.data.sites);
      sendResponse({ success: true });

    } else if (message.action === "closeCurrentTab") {
      if (sender.tab && sender.tab.id) {
        chrome.tabs.remove(sender.tab.id, () => {
          if (chrome.runtime.lastError) {
            console.error("Error closing tab:", chrome.runtime.lastError.message);
          }
        });
      }

    } else if (message.action === "cancelFocusSession") {
      cancelFocusSession();
      sendResponse({ success: true });

    } else if (message.action === "getFocusState") {
      sendResponse({ focusState });

    } else if (message.action === "checkCurrentSite") {
      if (focusState.isActive && message.url) {
        const isBlocked = checkIfSiteIsBlocked(message.url, sender.tab.id);
        sendResponse({ isBlocked });
      } else {
        sendResponse({ isBlocked: false });
      }

    } else if (message.action === "getRandomMeme") {
      getRandomMeme().then(meme => {
        sendResponse({ meme });
      }).catch((error) => {
        console.error("Error getting random meme:", error);
        sendResponse({ meme: getRandomMemeSync() });
      });
      return true; // Keep the message channel open for async response
    }
  } catch (error) {
    console.error("Error handling message:", message.action, error);
    sendResponse({ error: error.message });
  }

  return true; // Needed for async response
});


function createPlaceholderIcon() {
  try {
    const canvas = new OffscreenCanvas(48, 48);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#6366f1';
    ctx.beginPath();
    ctx.arc(24, 24, 20, 0, 2 * Math.PI);
    ctx.fill();
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(24, 24, 12, 0, 2 * Math.PI);
    ctx.fill();
    
    canvas.convertToBlob().then(blob => {
      const reader = new FileReader();
      reader.onloadend = function() {
        const iconData = reader.result;
        chrome.storage.local.set({ placeholderIcon: iconData });
      };
      reader.readAsDataURL(blob);
    }).catch(error => {
      console.error("Error creating placeholder icon:", error);
    });
  } catch (error) {
    console.error("Failed to create placeholder icon:", error);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  updateBadge();
  createPlaceholderIcon();

  // Initialize storage values if they don't exist
  chrome.storage.local.get(['memesCreated'], (result) => {
    if (!result.memesCreated) {
      chrome.storage.local.set({ memesCreated: true });
    }
  });
  
  chrome.storage.local.get(['focusState'], (result) => {
    if (!result.focusState) {
      chrome.storage.local.set({ 
        focusState: {
          isActive: false,
          startTime: null,
          duration: 0,
          blockedSites: [],
          streaks: 0,
          totalFocusTime: 0,
          lastCompletedSession: null
        }
      });
    }
  });
});