(function () {
  "use strict";

  const DEBUG = true;

  const blocklist = [
    "googleads",
    "doubleclick.net",
    "pubads",
    "adserver",
    "heads-fa.spotify.com",
    "audio-ak-spotify.com",
    "audio-fa.spotify.com",
    "audio-sp-".toLowerCase(),
    "spclient.wg.spotify.com/ad-logic",
    "spclient.wg.spotify.com/ads",
    "pagead2.googlesyndication.com",
    "adservice.google.com",
    "youtube.com/pagead/",
    "youtube.com/ptracking",
    "youtube.com/api/stats/ads",
    "youtube.com/api/stats/qoe",
    "youtube.com/api/stats/watchtime",
    "youtube.com/get_midroll_info",
    "adnxs.com",
    "scorecardresearch.com",
    "quantserve.com",
  ];

  function shouldBlock(url) {
    if (!url) return false;
    const urlString = String(url).toLowerCase();
    return blocklist.some((domain) => urlString.includes(domain));
  }

  function logBlock(type, url) {
    if (DEBUG) {
      console.warn(`[Adblock Intercepted ${type}]:`, url);
    }
  }

  // Recursive ad payload cleaner for YouTube responses
  function cleanYoutubeAdData(obj) {
    if (!obj || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        cleanYoutubeAdData(obj[i]);
      }
      return;
    }

    const adProperties = ["adPlacements", "playerAds", "adSlots"];
    for (const prop of adProperties) {
      if (prop in obj) {
        if (DEBUG) console.log(`[Adblock] Stripped ${prop}`);
        obj[prop] = [];
      }
    }

    for (const key in obj) {
      if (
        Object.prototype.hasOwnProperty.call(obj, key) &&
        typeof obj[key] === "object"
      ) {
        cleanYoutubeAdData(obj[key]);
      }
    }
  }

  // Intercept Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function (input, init) {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : "";

    if (shouldBlock(url)) {
      logBlock("Fetch", url);
      return new Response("", {
        status: 204,
        statusText: "No Content",
      });
    }

    if (
      url.includes("/youtubei/v1/player") ||
      url.includes("/youtubei/v1/next")
    ) {
      try {
        const response = await originalFetch.apply(this, arguments);
        const clone = response.clone();
        let data = await clone.json();

        cleanYoutubeAdData(data);

        return new Response(JSON.stringify(data), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (e) {
        if (DEBUG) console.error("[Adblock] Error cleaning Fetch response:", e);
      }
    }

    return originalFetch.apply(this, arguments);
  };

  // Intercept XMLHttpRequest (XHR)
  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    this._url = url;
    return originalOpen.apply(this, arguments);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    const urlString = String(this._url || "").toLowerCase();

    if (shouldBlock(this._url)) {
      logBlock("XHR", this._url);
      try {
        Object.defineProperty(this, "status", {
          writable: true,
          configurable: true,
          value: 204,
        });
        Object.defineProperty(this, "statusText", {
          writable: true,
          configurable: true,
          value: "No Content",
        });
        Object.defineProperty(this, "responseText", {
          writable: true,
          configurable: true,
          value: "",
        });
        Object.defineProperty(this, "response", {
          writable: true,
          configurable: true,
          value: "",
        });
        Object.defineProperty(this, "readyState", {
          writable: true,
          configurable: true,
          value: 4,
        });
      } catch (e) {
        // Fallback
      }

      if (typeof this.onload === "function") {
        this.onload();
      }
      const event = new Event("load");
      this.dispatchEvent(event);
      return;
    }

    if (
      urlString.includes("/youtubei/v1/player") ||
      urlString.includes("/youtubei/v1/next")
    ) {
      const self = this;
      const cleanXHRResponse = () => {
        try {
          let data = JSON.parse(self.responseText);
          cleanYoutubeAdData(data);
          const responseString = JSON.stringify(data);

          try {
            Object.defineProperty(self, "responseText", {
              writable: true,
              configurable: true,
              value: responseString,
            });
            Object.defineProperty(self, "response", {
              writable: true,
              configurable: true,
              value: responseString,
            });
          } catch (e) {
            Object.defineProperty(self, "responseText", {
              get: () => responseString,
              configurable: true,
            });
            Object.defineProperty(self, "response", {
              get: () => responseString,
              configurable: true,
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.addEventListener("readystatechange", function () {
        if (self.readyState === 4 && self.status === 200) {
          cleanXHRResponse();
        }
      });

      this.addEventListener("load", function () {
        if (self.status === 200) {
          cleanXHRResponse();
        }
      });
    }

    return originalSend.apply(this, arguments);
  };

  // Intercept initial window objects
  const interceptInitialObjects = () => {
    let initialPlayerResponse = window.ytInitialPlayerResponse;
    Object.defineProperty(window, "ytInitialPlayerResponse", {
      get: () => initialPlayerResponse,
      set: (val) => {
        if (val) {
          cleanYoutubeAdData(val);
        }
        initialPlayerResponse = val;
      },
      configurable: true,
    });

    let initialData = window.ytInitialData;
    Object.defineProperty(window, "ytInitialData", {
      get: () => initialData,
      set: (val) => {
        if (val) {
          cleanYoutubeAdData(val);
        }
        initialData = val;
      },
      configurable: true,
    });

    if (window.ytInitialPlayerResponse) {
      cleanYoutubeAdData(window.ytInitialPlayerResponse);
    }
    if (window.ytInitialData) {
      cleanYoutubeAdData(window.ytInitialData);
    }
  };
  interceptInitialObjects();

  // Inject UI cleaner styles
  const style = document.createElement("style");
  style.innerHTML = `
    ytd-ad-slot-renderer,
    ytd-companion-card-renderer,
    ytd-promoted-sparkles-web-renderer,
    ytd-display-ad-renderer,
    ytd-statement-banner-renderer,
    ytd-compact-promoted-video-renderer,
    ytd-compact-promoted-item-renderer,
    ytd-banner-promo-renderer,
    ytd-brand-video-shelf-renderer,
    ytd-in-feed-ad-layout-renderer,
    #player-ads,
    #masthead-ad,
    .ytd-carousel-ad-renderer,
    .ytd-player-legacy-desktop-watch-ads-renderer,
    .ytp-ad-overlay-container,
    .ytp-ad-message-container,
    .ytp-ad-action-button,
    #rendering-content .ytd-ad-slot-renderer,
    .main-leaderboard-container,
    .main-topBar-upgradeButton,
    [aria-label="Upgrade to Premium"],
    .ReactModalPortal:has([href*="premium"]),
    div[class*="Sponsored"],
    span[class*="Sponsored"],
    a[href*="/ad/"],
    iframe[src*="doubleclick.net"],
    iframe[src*="adnxs.com"],
    .ytp-ad-player-overlay,
    .ytp-ad-player-overlay-layout,
    .ytp-ad-image-overlay,
    .sponsored-container,
    [data-testid="sponsored-profile-badge"] {
      display: none !important;
      opacity: 0 !important;
      height: 0 !important;
      width: 0 !important;
      pointer-events: none !important;
    }
  `;
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.documentElement.appendChild(style);
  }

  // YouTube Auto Skip and Mute
  const skipYouTubeAds = () => {
    const video = document.querySelector("video");
    const player = document.querySelector(".html5-video-player");
    const hasAdOverlay = document.querySelector(
      ".ytp-ad-player-overlay, .ytp-ad-overlay-container, .ytp-ad-skip-button-container, .ytp-ad-player-overlay-layout",
    );
    const adShowing =
      (player &&
        (player.classList.contains("ad-showing") ||
          player.classList.contains("ad-interrupting"))) ||
      hasAdOverlay;

    if (video && adShowing) {
      if (!video.muted) {
        video.muted = true;
        if (DEBUG) console.log("[Adblock] Muted YouTube ad video");
      }

      const skipButton = document.querySelector(
        ".ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-self-modern",
      );
      if (skipButton) {
        skipButton.click();
        if (DEBUG) console.log("[Adblock] Clicked YouTube skip button");
      } else {
        if (video.playbackRate < 16) {
          video.playbackRate = 16;
          if (DEBUG) console.log("[Adblock] Speed up YouTube ad to 16x");
        }
        if (video.currentTime < video.duration && isFinite(video.duration)) {
          video.currentTime = video.duration - 0.1;
        }
      }
    }
  };

  // Spotify Auto Mute
  const muteSpotifyAds = () => {
    const nowPlayingWidget = document.querySelector(
      '[data-testid="now-playing-widget"]',
    );
    const adLink = document.querySelector(
      '[data-testid="now-playing-widget"] a[href*="/ad/"]',
    );
    const isAdPlaying =
      adLink ||
      (nowPlayingWidget &&
        nowPlayingWidget.innerText.toLowerCase().includes("advertisement"));

    const audioElements = document.querySelectorAll("audio");
    audioElements.forEach((audio) => {
      if (isAdPlaying) {
        if (!audio.dataset.mutedByAdblock) {
          audio.dataset.originalVolume = audio.volume;
          audio.volume = 0;
          audio.dataset.mutedByAdblock = "true";
          if (DEBUG) console.log("[Adblock] Muted Spotify audio ad");
        }
        const skipButton = document.querySelector(
          '[data-testid="control-button-skip-forward"]',
        );
        if (skipButton && !skipButton.disabled) {
          skipButton.click();
          if (DEBUG) console.log("[Adblock] Clicked Spotify skip button");
        }
      } else {
        if (audio.dataset.mutedByAdblock === "true") {
          audio.volume = parseFloat(audio.dataset.originalVolume) || 1.0;
          delete audio.dataset.mutedByAdblock;
          if (DEBUG) console.log("[Adblock] Restored Spotify volume");
        }
      }
    });
  };

  // Fast intervals for immediate ad response
  setInterval(() => {
    if (window.location.hostname.includes("youtube.com")) {
      skipYouTubeAds();
    }
    if (window.location.hostname.includes("spotify.com")) {
      muteSpotifyAds();
    }
  }, 100);

  if (DEBUG) {
    console.log("[Adblock] Request Interceptor initialized successfully.");
  }
})();
