(async function() {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  let cachedMessages = null;
  let messagesPromise = null;

  async function loadMessages() {
      if (cachedMessages) return cachedMessages;
      if (messagesPromise) return messagesPromise;
      
      messagesPromise = (async () => {
          let locale = 'en';
          
          try {
              const result = await api.storage.local.get(['userLocale']);
              locale = result.userLocale || 'en';
          } catch (e) {}
          
          try {
              const messagesUrl = api.runtime.getURL(`_locales/${locale}/messages.json`);
              const messagesResponse = await fetch(messagesUrl);
              if (messagesResponse.ok) {
                  cachedMessages = await messagesResponse.json();
                  return cachedMessages;
              }
          } catch (e) {}
          
          const fallbackUrl = api.runtime.getURL('_locales/en/messages.json');
          const fallbackResponse = await fetch(fallbackUrl);
          cachedMessages = await fallbackResponse.json();
          return cachedMessages;
      })();
      
      return messagesPromise;
  }

  function getMessage(key, substitutions) {
      if (!cachedMessages || !cachedMessages[key]) {
          return key;
      }
      
      let message = cachedMessages[key].message;
      
      if (substitutions) {
          const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
          subs.forEach((sub, index) => {
              message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
          });
      }
      
      return message;
  }

  const localizationReady = loadMessages();
  await localizationReady;

  function injectCSS() {
    if (document.getElementById('roearn-rainbow-animation')) {
      return;
    }

    if (!document.head) {
      setTimeout(injectCSS, 10);
      return;
    }

    const style = document.createElement('style');
    style.id = 'roearn-rainbow-animation';
    style.textContent = `
      @keyframes rainbow-flow {
        0% {
          background-position: 0% 50%;
        }
        50% {
          background-position: 100% 50%;
        }
        100% {
          background-position: 0% 50%;
        }
      }
      
      .action-button > .PurchaseButton,
      .action-button > button[id="roearnbuy"],
      .action-button > .btn-growth-lg,
      .action-button > .btn-fixed-width-lg:not(.roearn-gamepass-page-button):not(.roearn-gamepass-page-not-eligible),
      .action-button > .btn-primary-lg:not(.roearn-gamepass-page-button):not(.roearn-gamepass-page-not-eligible) {
        display: none !important;
      }
      
      .action-button[data-roearn-not-eligible="true"] > .PurchaseButton,
      .action-button[data-roearn-not-eligible="true"] > button[id="roearnbuy"],
      .action-button[data-roearn-not-eligible="true"] > .btn-growth-lg,
      .action-button[data-roearn-not-eligible="true"] > .btn-fixed-width-lg:not(.roearn-gamepass-page-button):not(.roearn-gamepass-page-not-eligible),
      .action-button[data-roearn-not-eligible="true"] > .btn-primary-lg:not(.roearn-gamepass-page-button):not(.roearn-gamepass-page-not-eligible) {
        display: block !important;
      }
    `;
    document.head.appendChild(style);
  }

  injectCSS();

  async function getAuthenticatedUserId() {
    try {
      const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        return null;
      }
      
      const data = await response.json();
      return data.id;
    } catch (error) {
      return null;
    }
  }

  function waitForElement(selector, timeout = 10000, signal = null) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error('Aborted'));
        return;
      }
      
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations) => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          clearTimeout(timeoutId);
          resolve(element);
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
      
      if (signal) {
        signal.addEventListener('abort', () => {
          observer.disconnect();
          clearTimeout(timeoutId);
          reject(new Error('Aborted'));
        });
      }
    });
  }

  let isAddingButton = false;
  let currentAbortController = null;
  
  const BUTTON_ADDED_MARKER = 'data-roearn-processed';

  async function addGamePassCashbackButton() {
    if (isAddingButton) {
      return;
    }
    
    try {
      isAddingButton = true;
      
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      
      const gamePassPattern = /^\/(?:[a-z]{2}\/)?game-pass\/(\d+)\//;
      const match = window.location.pathname.match(gamePassPattern);
      
      if (!match) {
        return;
      }
      
      const gamePassId = match[1];
      
      if (document.querySelector('.roearn-gamepass-page-button') || 
          document.querySelector('.roearn-gamepass-page-not-eligible')) {
        return;
      }
      
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return;
      }
            
      let itemPrice = null;
      let cashbackAmount = 0;
      let itemName = 'Unknown Gamepass';
      
      try {
        const response = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/${gamePassId}/product-info`, {
          credentials: 'include'
        });
        const data = await response.json();
        
        if (data.PriceInRobux !== undefined && data.PriceInRobux !== null) {
          itemPrice = data.PriceInRobux;
          itemName = data.Name || 'Unknown Gamepass';
          
          const cashbackRate = 0.05;
          const baseAmount = itemPrice * cashbackRate;
          cashbackAmount = Math.floor(baseAmount * 0.70);
        }
      } catch (error) {
        return;
      }
      
      let itemThumbnail = '';
      const thumbnailElement = document.querySelector('.thumbnail-span img');
      if (thumbnailElement) {
        itemThumbnail = thumbnailElement.getAttribute('src');
      }
      
      if (itemPrice === null) {
        return;
      }
      
      const minPrice = 40;
      const isEligible = itemPrice >= minPrice && cashbackAmount >= 1;
            
      const actionButton = await waitForElement('.action-button', 10000, signal);
      
      await waitForElement('.action-button .PurchaseButton, .action-button button[id="roearnbuy"], .action-button .btn-growth-lg', 10000, signal);
      
      if (actionButton.querySelector('.roearn-gamepass-page-button') || 
          actionButton.querySelector('.roearn-gamepass-page-not-eligible')) {
        return;
      }
      
      const originalButton = actionButton.querySelector('.PurchaseButton') || 
                             actionButton.querySelector('button[id="roearnbuy"]') ||
                             actionButton.querySelector('.btn-growth-lg');
      if (!originalButton) {
        return;
      }
      
      const originalIcon = document.querySelector('.icon-robux-16x16');
      const robuxIcon = originalIcon ? originalIcon.cloneNode(true) : document.createElement('span');
      if (originalIcon) {
        robuxIcon.style.display = 'inline-block';
        robuxIcon.style.marginLeft = '4px';
        robuxIcon.style.marginRight = '0px';
        robuxIcon.style.filter = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))';
      }
      
      const cashbackButton = document.createElement('button');
      cashbackButton.type = 'button';
      cashbackButton.className = 'btn-primary-lg';
      
      if (!isEligible) {
        actionButton.setAttribute('data-roearn-not-eligible', 'true');
        
        const infoIcon = document.createElement('span');
        infoIcon.className = 'info-icon';
        infoIcon.textContent = 'i';
        infoIcon.style.cssText = `
          display: inline-block;
          margin-left: 8px;
          width: 18px;
          height: 18px;
          border: 2px solid white;
          border-radius: 50%;
          text-align: center;
          line-height: 14px;
          font-size: 13px;
          font-style: normal;
          font-weight: bold;
          vertical-align: baseline;
          position: relative;
          top: 0px;
          cursor: help;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        `;
        
        const tooltipContainer = document.createElement('div');
        tooltipContainer.style.cssText = `
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 10px;
          z-index: 10000;
          pointer-events: none;
        `;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'roearn-gamepass-page-tooltip';
        tooltip.textContent = getMessage("tooltipGamepassMinPrice");
        tooltip.style.cssText = `
          visibility: hidden;
          opacity: 0;
          background-color: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 10px 15px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: normal;
          white-space: normal;
          width: max-content;
          max-width: 300px;
          text-align: center;
          transition: opacity 0.2s, visibility 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        const arrow = document.createElement('div');
        arrow.style.cssText = `
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid rgba(0, 0, 0, 0.9);
        `;
        tooltip.appendChild(arrow);
        tooltipContainer.appendChild(tooltip);
        
        infoIcon.addEventListener('mouseenter', () => {
          tooltip.style.visibility = 'visible';
          tooltip.style.opacity = '1';
        });
        
        infoIcon.addEventListener('mouseleave', () => {
          tooltip.style.visibility = 'hidden';
          tooltip.style.opacity = '0';
        });
        
        cashbackButton.textContent = getMessage("ineligible") + ' ';
        cashbackButton.appendChild(infoIcon);
        cashbackButton.style.position = 'relative';
        cashbackButton.appendChild(tooltipContainer);
        cashbackButton.classList.add('roearn-gamepass-page-not-eligible');
        
        cashbackButton.style.background = '#6c757d';
        cashbackButton.style.border = 'none';
        cashbackButton.style.color = 'white';
        cashbackButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
        cashbackButton.style.fontWeight = 'bold';
        cashbackButton.style.cursor = 'not-allowed';
        cashbackButton.style.display = 'flex';
        cashbackButton.style.alignItems = 'center';
        cashbackButton.style.justifyContent = 'center';
        cashbackButton.style.marginBottom = '10px';
        cashbackButton.style.width = 'auto';
        cashbackButton.style.minWidth = 'fit-content';
        cashbackButton.style.maxWidth = '100%';
        cashbackButton.style.paddingLeft = '20px';
        cashbackButton.style.paddingRight = '20px';
        cashbackButton.style.whiteSpace = 'nowrap';
                
        cashbackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        
      } else {
        const rawTemplate = cachedMessages?.gamepassBuyBtn?.message || "Buy (Earn $1)";
        const parts = rawTemplate.split("$1");
        
        cashbackButton.textContent = '';
        cashbackButton.appendChild(document.createTextNode(parts[0]));
        cashbackButton.appendChild(robuxIcon);
        cashbackButton.appendChild(document.createTextNode(" " + cashbackAmount + (parts[1] || "")));
        cashbackButton.classList.add('roearn-gamepass-page-button');
        
        cashbackButton.style.background = `linear-gradient(90deg, 
          #6bb5ff, 
          #a66bff, 
          #d66bff, 
          #ff6bbd,
          #d66bff,
          #a66bff,
          #6bb5ff
        )`;
        cashbackButton.style.backgroundSize = '200% 100%';
        cashbackButton.style.animation = 'rainbow-flow 6s ease-in-out infinite';
        cashbackButton.style.border = 'none';
        cashbackButton.style.color = 'white';
        cashbackButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)';
        cashbackButton.style.fontWeight = 'bold';
        cashbackButton.style.display = 'flex';
        cashbackButton.style.alignItems = 'center';
        cashbackButton.style.justifyContent = 'center';
        cashbackButton.style.cursor = 'pointer';
        cashbackButton.style.marginBottom = '10px';
        
        cashbackButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
                    
          if (!itemThumbnail) {
            return;
          }
          
          window.dispatchEvent(new CustomEvent('roearn:showCheckout', {
            detail: {
              thumbnail: itemThumbnail,
              assetName: itemName,
              assetId: String(gamePassId),
              assetType: 'gamepass',
              userId: String(userId),
              earnAmount: cashbackAmount,
              assetPrice: itemPrice,
            }
          }));
        }, true); 
      }
      
      actionButton.insertBefore(cashbackButton, originalButton);

    } catch (error) {
    } finally {
      isAddingButton = false;
    }
  }

  addGamePassCashbackButton();

  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      
      if (currentAbortController) {
        currentAbortController.abort();
      }
      
      const existingButton = document.querySelector('.roearn-gamepass-page-button, .roearn-gamepass-page-not-eligible');
      if (existingButton && existingButton.parentNode) {
        existingButton.parentNode.removeChild(existingButton);
      }
      
      const actionButtonContainer = document.querySelector('.action-button[data-roearn-not-eligible="true"]');
      if (actionButtonContainer) {
        actionButtonContainer.removeAttribute('data-roearn-not-eligible');
      }
      
      addGamePassCashbackButton();
    }
  }).observe(document.documentElement || document.body || document, { subtree: true, childList: true });
})();