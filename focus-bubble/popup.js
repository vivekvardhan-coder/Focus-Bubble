// popup.js
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
  const setupSection = document.getElementById('setup-session');
  const activeSection = document.getElementById('active-session');
  const completedMessage = document.getElementById('completed-message');
  const statsSection = document.getElementById('stats-section');
  const streakCount = document.getElementById('streak-count');
  const totalTime = document.getElementById('total-time');
  const durationInput = document.getElementById('duration');
  const sitesContainer = document.getElementById('sites-container');
  const addSiteBtn = document.getElementById('add-site-btn');
  const startBtn = document.getElementById('start-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const newSessionBtn = document.getElementById('new-session-btn');
  const countdown = document.getElementById('countdown');
  const blockedSitesList = document.getElementById('blocked-sites-list');
  const timerProgress = document.getElementById('timer-progress');
  const timerCircle = document.getElementById('timer-circle');
  const quickStartBtns = document.getElementById('quick-start-buttons');
  const commonSitesContainer = document.getElementById('common-sites');
  
  // Common distraction sites
  const commonDistractionSites = [
    { name: 'Social Media', sites: ['facebook.com', 'twitter.com', 'instagram.com', 'tiktok.com'] },
    { name: 'Video', sites: ['youtube.com', 'netflix.com', 'hulu.com', 'twitch.tv'] },
    { name: 'News', sites: ['reddit.com', 'news.google.com', 'cnn.com', 'bbc.com'] },
    { name: 'Shopping', sites: ['amazon.com', 'ebay.com', 'etsy.com', 'walmart.com'] }
  ];
  
  let countdownInterval;
  let endTime;
  let totalDuration = 0;
  let animationFrame;
  let suggestionAdded = false;
  
  // Initialize
  loadState();
  initializeQuickStartButtons();
  initializeCommonSitesSuggestions();
  
  // Add initial site input
  if (sitesContainer.querySelectorAll('.site-input').length === 0) {
    addSiteInput();
  }
  
  // Event Listeners
  addSiteBtn.addEventListener('click', addSiteInput);
  startBtn.addEventListener('click', startFocusSession);
  cancelBtn.addEventListener('click', cancelFocusSession);
  newSessionBtn.addEventListener('click', showSetupSection);
  
  // Duration input validation
  durationInput.addEventListener('input', function() {
    // Limit to 180 minutes (3 hours)
    if (parseInt(durationInput.value) > 180) {
      durationInput.value = 180;
    }
    // Prevent negative values
    if (parseInt(durationInput.value) < 0) {
      durationInput.value = 0;
    }
  });
  
  // Delegate event for remove site buttons
  sitesContainer.addEventListener('click', function(e) {
    if (e.target.classList.contains('remove-site-btn') || e.target.closest('.remove-site-btn')) {
      const siteInput = e.target.closest('.site-input');
      if (sitesContainer.querySelectorAll('.site-input').length > 1) {
        siteInput.remove();
      } else {
        siteInput.querySelector('input').value = '';
      }
    }
  });
  
// Listen for messages from background
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "focusSessionStarted") {
    updateActiveSession(message.data);
  } else if (message.action === "focusSessionCompleted") {
    showCompletedMessage();
    loadState(); // Make sure this is called to refresh the state
  } else if (message.action === "focusSessionCanceled") {
    showSetupSection();
    loadState(); // Make sure this is called to refresh the state
  }
});
  
  function loadState() {
    chrome.runtime.sendMessage({ action: "getFocusState" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Error getting focus state:", chrome.runtime.lastError);
        return;
      }
      
      if (response && response.focusState) {
        const state = response.focusState;
        
        // Update stats
        streakCount.textContent = state.streaks || 0;
        
        // Convert seconds to hours with 1 decimal place
        const hours = (state.totalFocusTime / 3600).toFixed(1);
        totalTime.textContent = hours;
        
        // Update the UI based on streak achievements
        updateStreakUI(state.streaks);
        
        // Check if there's an active session
        if (state.isActive) {
          const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
          const remaining = Math.max(0, state.duration - elapsed);
          totalDuration = state.duration;
          
          updateActiveSession({
            duration: state.duration,
            sites: state.blockedSites
          });
          startCountdown(remaining);
        } else {
          showSetupSection();
        }
      }
    });
  }
  
  function updateStreakUI(streaks) {
    // Add visual enhancements based on streak count
    if (streaks >= 50) {
      streakCount.classList.add('diamond-streak');
    } else if (streaks >= 25) {
      streakCount.classList.add('platinum-streak');
    } else if (streaks >= 10) {
      streakCount.classList.add('gold-streak');
    } else if (streaks >= 5) {
      streakCount.classList.add('silver-streak');
    } else if (streaks >= 1) {
      streakCount.classList.add('bronze-streak');
    }
  }
  
  function initializeQuickStartButtons() {
    // Create quick start duration buttons
    const durations = [
      { minutes: 25, label: '25m' },
      { minutes: 45, label: '45m' },
      { minutes: 60, label: '1h' },
      { minutes: 90, label: '1.5h' }
    ];
    
    durations.forEach(duration => {
      const btn = document.createElement('button');
      btn.className = 'quick-start-btn';
      btn.textContent = duration.label;
      btn.addEventListener('click', () => {
        durationInput.value = duration.minutes;
      });
      quickStartBtns.appendChild(btn);
    });
  }
  
  function initializeCommonSitesSuggestions() {
    commonDistractionSites.forEach(category => {
      const categoryBtn = document.createElement('button');
      categoryBtn.className = 'common-site-category';
      categoryBtn.textContent = category.name;
      categoryBtn.addEventListener('click', () => {
        // Add these sites to the list
        addSitesFromCategory(category.sites);
      });
      commonSitesContainer.appendChild(categoryBtn);
    });
  }
  
  function addSitesFromCategory(sites) {
    // Clear existing sites if only one empty input exists
    const inputs = sitesContainer.querySelectorAll('.site-input');
    if (inputs.length === 1 && inputs[0].querySelector('input').value === '') {
      inputs[0].remove();
    }
    
    // Add each site from the category
    sites.forEach(site => {
      const siteInput = document.createElement('div');
      siteInput.className = 'site-input';
      siteInput.innerHTML = `
        <input type="text" class="site-url" value="${site}" placeholder="e.g. youtube.com">
        <button class="btn-icon remove remove-site-btn"><i class="fas fa-trash-alt"></i></button>
      `;
      sitesContainer.appendChild(siteInput);
      
      // Add fade-in animation
      siteInput.classList.add('fade-in');
      setTimeout(() => {
        siteInput.classList.remove('fade-in');
      }, 500);
    });
  }
  
  function startFocusSession() {
    const duration = parseInt(durationInput.value);
    if (isNaN(duration) || duration <= 0) {
      showErrorMessage('Please enter a valid duration');
      return;
    }
    
    // Get blocked sites
    const sites = [];
    sitesContainer.querySelectorAll('.site-url').forEach(input => {
      const site = input.value.trim();
      if (site) {
        sites.push(site);
      }
    });
    
    if (sites.length === 0) {
      showErrorMessage('Please add at least one site to block');
      return;
    }
    
    totalDuration = duration * 60;
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: "startFocusSession",
      data: {
        duration: duration * 60, // convert to seconds
        sites: sites
      }
    }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error starting focus session:", chrome.runtime.lastError);
        showErrorMessage('Failed to start focus session. Please try again.');
        return;
      }
      
      if (response && response.success) {
        updateActiveSession({
          duration: duration * 60,
          sites: sites
        });
        
        startCountdown(duration * 60);
      }
    });
  }
  
  function showErrorMessage(message) {
    const errorEl = document.createElement('div');
    errorEl.className = 'error-message';
    errorEl.textContent = message;
    
    // Remove any existing error messages
    document.querySelectorAll('.error-message').forEach(el => el.remove());
    
    // Insert at the top of the setup section
    setupSection.insertBefore(errorEl, setupSection.firstChild);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      if (document.body.contains(errorEl)) {
        errorEl.classList.add('fade-out');
        setTimeout(() => {
          if (document.body.contains(errorEl)) {
            errorEl.remove();
          }
        }, 300);
      }
    }, 3000);
  }
  
  function cancelFocusSession() {
    chrome.runtime.sendMessage({ action: "cancelFocusSession" }, response => {
      if (chrome.runtime.lastError) {
        console.error("Error canceling focus session:", chrome.runtime.lastError);
        return;
      }
      
      clearInterval(countdownInterval);
      cancelAnimationFrame(animationFrame);
      showSetupSection();
    });
  }
  
  function updateActiveSession(data) {
    setupSection.style.display = 'none';
    completedMessage.style.display = 'none';
    activeSection.style.display = 'block';
    
    // Update blocked sites list
    blockedSitesList.innerHTML = '';
    data.sites.forEach(site => {
      const li = document.createElement('li');
      li.className = 'blocked-site-item';
      li.innerHTML = `<i class="fas fa-ban"></i> ${site}`;
      blockedSitesList.appendChild(li);
    });
    
    // Add suggestion for next time if not already added
    if (!suggestionAdded) {
      const suggestionSite = getSuggestionSite();
      if (suggestionSite && !data.sites.includes(suggestionSite)) {
        const suggestion = document.createElement('div');
        suggestion.className = 'site-suggestion';
        suggestion.innerHTML = `
          <p>Suggestion for next time:</p>
          <div class="suggestion-content">
            <span>${suggestionSite}</span>
            <button id="add-suggestion" class="btn-small">Add</button>
          </div>
        `;
        activeSection.appendChild(suggestion);
        
        document.getElementById('add-suggestion').addEventListener('click', function() {
          // Save this site for next session
          chrome.storage.local.get(['nextSessionSites'], result => {
            const sites = result.nextSessionSites || [];
            if (!sites.includes(suggestionSite)) {
              sites.push(suggestionSite);
              chrome.storage.local.set({ nextSessionSites: sites });
              suggestion.innerHTML = '<p>Added for your next session!</p>';
            }
          });
        });
        
        suggestionAdded = true;
      }
    }
  }
  
  function getSuggestionSite() {
    // Suggest a common distraction site not already in the list
    const allSites = [];
    commonDistractionSites.forEach(category => {
      category.sites.forEach(site => {
        allSites.push(site);
      });
    });
    
    // Additional sites that are commonly distracting
    const moreSites = [
      'pinterest.com', 'linkedin.com', 'discord.com', 'whatsapp.com',
      'messenger.com', 'slack.com', 'telegram.org', 'digg.com'
    ];
    
    allSites.push(...moreSites);
    
    // Return a random site from the combined list
    return allSites[Math.floor(Math.random() * allSites.length)];
  }
  
  function showSetupSection() {
    setupSection.style.display = 'block';
    activeSection.style.display = 'none';
    completedMessage.style.display = 'none';
    statsSection.style.display = 'block';
    clearInterval(countdownInterval);
    cancelAnimationFrame(animationFrame);
    
    // Check if we have sites to add from a previous suggestion
    chrome.storage.local.get(['nextSessionSites'], result => {
      if (result.nextSessionSites && result.nextSessionSites.length > 0) {
        // Add these sites
        addSitesFromCategory(result.nextSessionSites);
        // Clear the stored sites
        chrome.storage.local.set({ nextSessionSites: [] });
      }
    });
  }
  
  function showCompletedMessage() {
    setupSection.style.display = 'none';
    activeSection.style.display = 'none';
    completedMessage.style.display = 'block';
    statsSection.style.display = 'block';
    clearInterval(countdownInterval);
    cancelAnimationFrame(animationFrame);
    
    // Force a state refresh
    loadState();
    
    // Add confetti effect
    createConfetti();
    
    // Show completed message for 5 seconds, then go back to setup
    setTimeout(() => {
      showSetupSection();
    }, 5000);
  }
  
  function createConfetti() {
    if (!document.getElementById('confetti-canvas')) {
      const canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(canvas);
      
      const ctx = canvas.getContext('2d');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      const pieces = [];
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];
      
      for (let i = 0; i < 100; i++) {
        pieces.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height - canvas.height,
          size: Math.random() * 5 + 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 2,
          speed: Math.random() * 1 + 1
        });
      }
      
      function animate() {
        if (!document.getElementById('confetti-canvas')) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        pieces.forEach(piece => {
          ctx.save();
          ctx.translate(piece.x, piece.y);
          ctx.rotate((piece.rotation * Math.PI) / 180);
          ctx.fillStyle = piece.color;
          ctx.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
          ctx.restore();
          
          piece.y += piece.speed;
          piece.rotation += piece.rotationSpeed;
          
          if (piece.y > canvas.height) {
            piece.y = -piece.size;
            piece.x = Math.random() * canvas.width;
          }
        });
        
        requestAnimationFrame(animate);
      }
      
      animate();
      
      // Remove confetti after 5 seconds
      setTimeout(() => {
        if (canvas && document.body.contains(canvas)) {
          document.body.removeChild(canvas);
        }
      }, 5000);
    }
  }
  
  function startCountdown(seconds) {
    clearInterval(countdownInterval);
    cancelAnimationFrame(animationFrame);
    endTime = Date.now() + seconds * 1000;
    
    updateCountdown();
    
    countdownInterval = setInterval(updateCountdown, 1000);
    
    // Start the circular progress animation
    if (timerCircle) {
      animateCircularProgress();
    }
  }
  
  function updateCountdown() {
    const secondsLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    
    if (secondsLeft <= 0) {
      clearInterval(countdownInterval);
      cancelAnimationFrame(animationFrame);
      // Note: The session completion is handled by the background script
    }
    
    // Update progress bar
    if (totalDuration > 0) {
      const progress = 100 - (secondsLeft / totalDuration * 100);
      timerProgress.style.width = `${progress}%`;
    }
    
    const minutes = Math.floor(secondsLeft / 60);
    const seconds = secondsLeft % 60;
    countdown.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  function animateCircularProgress() {
    if (!timerCircle) return;
    
    function updateCircle() {
      const secondsLeft = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      if (totalDuration > 0) {
        const progress = 100 - (secondsLeft / totalDuration * 100);
        const circumference = 2 * Math.PI * 45; // radius is 45px
        const offset = circumference - (progress / 100) * circumference;
        timerCircle.style.strokeDasharray = `${circumference} ${circumference}`;
        timerCircle.style.strokeDashoffset = offset;
      }
      
      if (secondsLeft > 0) {
        animationFrame = requestAnimationFrame(updateCircle);
      }
    }
    
    updateCircle();
  }

  
  function addSiteInput() {
    const siteInput = document.createElement('div');
    siteInput.className = 'site-input';
    siteInput.innerHTML = `
      <input type="text" class="site-url" placeholder="e.g. youtube.com">
      <button class="btn-icon remove remove-site-btn"><i class="fas fa-trash-alt"></i></button>
    `;
    sitesContainer.appendChild(siteInput);
    
    // Add fade-in animation
    siteInput.classList.add('fade-in');
    setTimeout(() => {
      siteInput.classList.remove('fade-in');
    }, 500);
    
    // Focus the new input
    const newInput = siteInput.querySelector('input');
    newInput.focus();
  }
});