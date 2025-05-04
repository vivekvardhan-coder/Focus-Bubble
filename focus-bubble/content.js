// content.js
(function() {
  let memeOverlay = null;
  let floatingIcon = null;
  let tooltipTimeout = null;
  let isInjected = false;

  // Message listener for communication with background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === "showMemeOverlay") {
        showMemeOverlay();
        sendResponse({ success: true });
      }
    } catch (error) {
      console.error("Error processing message:", error);
      sendResponse({ success: false, error: error.message });
    }
    return true; // Keep the message channel open for async response
  });

  // Initialize content script when DOM is ready
  function initializeContentScript() {
    if (isInjected) return; // Prevent multiple injections
    isInjected = true;
    
    // Check current site immediately
    checkCurrentSite();
    
    // Add floating bubble icon for active sessions
    checkFocusStateAndAddIcon();
    
    // Setup mutation observer to handle dynamic page changes
    observeDOMChanges();
  }

  // Safely initialize when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeContentScript, { once: true });
  } else {
    // Document is already ready
    initializeContentScript();
  }

  function observeDOMChanges() {
    // Monitor for DOM changes that might affect our overlay
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        // If our overlay was removed, re-add it if in focus mode
        if (mutation.type === 'childList' && 
            mutation.removedNodes.length > 0 && 
            Array.from(mutation.removedNodes).some(node => 
              node.id === 'focus-bubble-floating-icon' || 
              node.id === 'focus-bubble-overlay')) {
          
          // Check if we're still in focus mode before re-adding
// Example: Checking if current site is blocked
            chrome.runtime.sendMessage({ 
            action: "checkCurrentSite", 
            url: window.location.href 
            }, (response) => {
            if (chrome.runtime.lastError) {
            console.error("Messaging error:", chrome.runtime.lastError.message);
            return;
           }

          if (response && response.isBlocked) {
          console.log("This site is blocked during focus mode.");
          // Apply your blocking overlay or redirect
          } else {
         console.log("Site is allowed.");
        }
      });

        }
      });
    });
    
    // Start observing the document
    observer.observe(document.documentElement, { 
      childList: true, 
      subtree: true 
    });
  }

  function checkCurrentSite() {
    try {
      chrome.runtime.sendMessage({ 
        action: "checkCurrentSite", 
        url: window.location.href 
      }, response => {
        if (chrome.runtime.lastError) {
          console.warn("Error checking current site:", chrome.runtime.lastError);
        }
      });
    } catch (error) {
      console.error("Failed to check current site:", error);
    }
  }

  function checkFocusStateAndAddIcon() {
    try {
      chrome.runtime.sendMessage({ action: "getFocusState" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Error getting focus state:", chrome.runtime.lastError);
          return;
        }
        
        if (response?.focusState?.isActive) {
          addFloatingIcon();
        }
      });
    } catch (error) {
      console.error("Failed to check focus state:", error);
    }
  }

  function addFloatingIcon() {
    // Prevent duplicate icons
    if (document.getElementById('focus-bubble-floating-icon')) return;
    
    // Make sure we have a body to append to
    if (!document.body) {
      const bodyCheckInterval = setInterval(() => {
        if (document.body) {
          clearInterval(bodyCheckInterval);
          addFloatingIcon();
        }
      }, 50);
      return;
    }
    
    floatingIcon = document.createElement('div');
    floatingIcon.id = 'focus-bubble-floating-icon';
    floatingIcon.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background-color: #6366f1;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s ease;
    `;
    
    // Add icon inside
    floatingIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      </svg>
    `;
    
    // Add pulse animation
    addFloatingIconStyles();
    
    document.body.appendChild(floatingIcon);
    
    // Event listener for clicking the icon
    floatingIcon.addEventListener('click', handleFloatingIconClick);
  }

  function addFloatingIconStyles() {
    const styleId = 'focus-bubble-floating-icon-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes pulse {
        0% { transform: scale(1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
        50% { transform: scale(1.1); box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3); }
        100% { transform: scale(1); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); }
      }
      #focus-bubble-floating-icon {
        animation: pulse 2s infinite;
      }
      #focus-bubble-floating-icon:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 20px rgba(99, 102, 241, 0.3);
        animation: none;
      }
    `;
    
    document.head.appendChild(style);
  }

  function handleFloatingIconClick() {
    try {
      chrome.runtime.sendMessage({ action: "getFocusState" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Error getting focus state:", chrome.runtime.lastError);
          return;
        }
        
        if (response?.focusState) {
          const state = response.focusState;
          
          if (state.isActive) {
            showRemainingTimeTooltip(state);
          }
        }
      });
    } catch (error) {
      console.error("Failed to handle floating icon click:", error);
    }
  }

  function showRemainingTimeTooltip(state) {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const remaining = Math.max(0, state.duration - elapsed);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    
    showTooltip(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')} remaining`);
  }
  
  function showTooltip(text) {
    removeExistingTooltip();
    
    const tooltip = createTooltipElement(text);
    document.body.appendChild(tooltip);
    
    animateTooltip(tooltip);
  }

  function removeExistingTooltip() {
    const existingTooltip = document.getElementById('focus-bubble-tooltip');
    if (existingTooltip) {
      existingTooltip.style.opacity = '0';
      existingTooltip.style.transform = 'translateY(10px)';
      
      // Clear any existing timeout
      if (tooltipTimeout) {
        clearTimeout(tooltipTimeout);
      }
      
      tooltipTimeout = setTimeout(() => {
        if (document.body.contains(existingTooltip)) {
          document.body.removeChild(existingTooltip);
        }
      }, 300);
    }
  }

  function createTooltipElement(text) {
    const tooltip = document.createElement('div');
    tooltip.id = 'focus-bubble-tooltip';
    tooltip.innerText = text;
    tooltip.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background-color: #1f2937;
      color: white;
      padding: 8px 12px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      opacity: 0;
      transform: translateY(10px);
      transition: opacity 0.3s, transform 0.3s;
    `;
    return tooltip;
  }

  function animateTooltip(tooltip) {
    // Animate tooltip in
    setTimeout(() => {
      tooltip.style.opacity = '1';
      tooltip.style.transform = 'translateY(0)';
    }, 10);
    
    // Hide tooltip after delay
    tooltipTimeout = setTimeout(() => {
      tooltip.style.opacity = '0';
      tooltip.style.transform = 'translateY(10px)';
      
      tooltipTimeout = setTimeout(() => {
        if (document.body.contains(tooltip)) {
          document.body.removeChild(tooltip);
        }
      }, 300);
    }, 3000);
  }

  function showMemeOverlay() {
    if (memeOverlay) return;
    
    if (!document.body) {
      waitForBodyAndCreateOverlay();
    } else {
      createMemeOverlay();
    }
  }

  function waitForBodyAndCreateOverlay() {
    const bodyCheckInterval = setInterval(() => {
      if (document.body) {
        clearInterval(bodyCheckInterval);
        createMemeOverlay();
      }
    }, 50);
    
    // Safety timeout to prevent infinite waiting
    setTimeout(() => {
      clearInterval(bodyCheckInterval);
      console.error("Timed out waiting for document.body");
    }, 10000);
  }

  // Update the createMemeOverlay function in content.js
function createMemeOverlay() {
  if (document.getElementById('focus-bubble-overlay')) return;
  
  memeOverlay = document.createElement('div');
  memeOverlay.id = 'focus-bubble-overlay';
  memeOverlay.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background-color: rgba(0, 0, 0, 0.95) !important;
    z-index: 2147483647 !important; /* Maximum z-index */
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
    align-items: center !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    color: white !important;
    opacity: 0 !important;
    transition: opacity 0.5s ease !important;
    pointer-events: auto !important;
  `;
  
  // Add this to prevent page scrolling
  document.body.style.overflow = 'hidden';
  
  document.body.appendChild(memeOverlay);
  fetchAndDisplayMeme();
}

// Update the removeMemeOverlay function
function removeMemeOverlay() {
  if (!memeOverlay || !document.body.contains(memeOverlay)) return;
  
  // Restore scrolling
  document.body.style.overflow = '';
  
  memeOverlay.style.opacity = '0';
  setTimeout(() => {
    if (memeOverlay && document.body.contains(memeOverlay)) {
      document.body.removeChild(memeOverlay);
    }
    memeOverlay = null;
  }, 600);
}

  function fetchAndDisplayMeme() {
    try {
      chrome.runtime.sendMessage({ action: "getRandomMeme" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Error fetching random meme:", chrome.runtime.lastError);
          // Use fallback meme if there's an error
          const fallbackMeme = {
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%236366f1'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EBack to work!%3C/text%3E%3C/svg%3E",
            caption: "One does not simply browse distracting sites during focus time",
            animated: false
          };
          displayMeme(fallbackMeme);
          return;
        }
        
        if (response?.meme) {
          displayMeme(response.meme);
        } else {
          // Use fallback meme if no meme is returned
          const fallbackMeme = {
            url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%236366f1'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EBack to work!%3C/text%3E%3C/svg%3E",
            caption: "Focus time activated!",
            animated: false
          };
          displayMeme(fallbackMeme);
        }
      });
    } catch (error) {
      console.error("Failed to fetch meme:", error);
      // Use fallback meme if there's an error
      const fallbackMeme = {
        url: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%236366f1'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EBack to work!%3C/text%3E%3C/svg%3E",
        caption: "Stay focused!",
        animated: false
      };
      displayMeme(fallbackMeme);
    }
  }

  function displayMeme(meme) {
    // Check if overlay still exists
    if (!memeOverlay || !document.body.contains(memeOverlay)) {
      // Recreate if it doesn't exist
      createMemeOverlay();
      return;
    }
    
    const memeContainer = document.createElement('div');
    memeContainer.style.cssText = `
      max-width: 600px;
      text-align: center;
      transform: scale(0.8);
      opacity: 0;
      transition: transform 0.5s ease, opacity 0.5s ease;
    `;

    const img = new Image();
    
    // Set up error handling for the image
    img.onerror = function() {
      console.error("Failed to load meme image:", meme.url);
      // Use fallback SVG if image fails to load
      img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'%3E%3Crect width='400' height='300' fill='%236366f1'/%3E%3Ctext x='200' y='150' font-family='Arial' font-size='24' text-anchor='middle' fill='white'%3EBack to work!%3C/text%3E%3C/svg%3E";
      buildMemeOverlayContent(meme, memeContainer, img);
      animateMemeOverlay();
    };
    
    img.onload = function() {
      buildMemeOverlayContent(meme, memeContainer, img);
      animateMemeOverlay();
    };
    
    img.style.cssText = `
      max-width: 100%;
      display: block;
      ${meme.animated ? '' : 'border-radius: 12px;'}
    `;
    
    // Set the source after setting up event handlers
    img.src = meme.url;
  }

  function buildMemeOverlayContent(meme, container, img) {
    const memeElement = document.createElement('div');
    memeElement.style.cssText = `
      margin-bottom: 20px;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    `;
    memeElement.appendChild(img);
    
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
    caption.innerText = meme.caption;
    
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
  chrome.runtime.sendMessage({ action: "closeCurrentTab" });
});

    
    container.appendChild(memeElement);
    container.appendChild(caption);
    container.appendChild(button);
    
    // Make sure the overlay exists before trying to append to it
    if (memeOverlay && document.body.contains(memeOverlay)) {
      // Clear any existing content
      memeOverlay.innerHTML = '';
      memeOverlay.appendChild(container);
    }
  }

  function animateMemeOverlay() {
    if (!memeOverlay || !document.body.contains(memeOverlay)) return;
    
    setTimeout(() => {
      memeOverlay.style.opacity = '1';
      setTimeout(() => {
        const container = memeOverlay.querySelector('div');
        if (container) {
          container.style.transform = 'scale(1)';
          container.style.opacity = '1';
        }
      }, 100);
    }, 50);
  }

})();