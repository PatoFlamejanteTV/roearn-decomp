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

  if (!document.getElementById('roearn-rainbow-animation')) {
    const gamepassStyle = document.createElement('style');
    gamepassStyle.id = 'roearn-rainbow-animation';
    gamepassStyle.textContent = `
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
      
      .PurchaseButton.rbx-gear-passes-purchase {
        display: none !important;
      }
      
      .PurchaseButton.rbx-gear-passes-purchase[data-roearn-not-eligible="true"] {
        display: block !important;
      }
    `;
    document.head.appendChild(gamepassStyle);
  }

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

  function waitForElement(selector, signal = null) {
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
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      
      if (signal) {
        signal.addEventListener('abort', () => {
          observer.disconnect();
          reject(new Error('Aborted'));
        });
      }
    });
  }

  let isAddingButtons = false;
  let currentAbortController = null;

  async function addGamePassCashbackButtons() {
    if (isAddingButtons) {
      return;
    }
    
    try {
      isAddingButtons = true;
      
      currentAbortController = new AbortController();
      const signal = currentAbortController.signal;
      
      const gamePagePattern = /^\/(?:[a-z]{2}\/)?games\/\d+\//;
      if (!gamePagePattern.test(window.location.pathname)) {
        return;
      }
      
      const isOnStoreTab = window.location.hash.includes('store') || 
                           document.querySelector('#tab-store.active') !== null ||
                           document.querySelector('.tab-pane.store.active') !== null;
      if (!isOnStoreTab) {
        return;
      }
            
      const userId = await getAuthenticatedUserId();
      if (!userId) {
        return;
      }
      
      const passesContainer = await waitForElement('#rbx-passes-container .PurchaseButton', signal);

      const purchaseButtons = document.querySelectorAll('#rbx-passes-container .PurchaseButton');
      
      if (purchaseButtons.length === 0) {
        return;
      }
            
      purchaseButtons.forEach((originalButton) => {
        const footer = originalButton.closest('.store-card-footer');
        if (footer.querySelector('.roearn-gamepass-cashback-button')) {
          return;
        }
        
        const storeCard = originalButton.closest('.store-card');
        const storeCardCaption = originalButton.closest('.store-card-caption');
        const listItem = originalButton.closest('.list-item');
        
        if (storeCard) {
          storeCard.style.overflow = 'visible';
          storeCard.style.height = 'auto';
          storeCard.style.minHeight = 'auto';
        }
        if (storeCardCaption) {
          storeCardCaption.style.overflow = 'visible';
          storeCardCaption.style.height = 'auto';
        }
        if (listItem) {
          listItem.style.overflow = 'visible';
          listItem.style.height = 'auto';
        }
        if (footer) {
          footer.style.overflow = 'visible';
          footer.style.height = 'auto';
        }
        
        const price = parseInt(originalButton.getAttribute('data-expected-price')) || 0;
        
        const assetNameElement = storeCard.querySelector('.store-card-name');
        const assetName = assetNameElement ? assetNameElement.textContent.trim() : 'Unknown Gamepass';
        
        const thumbnailLink = storeCard.querySelector('.gear-passes-asset');
        let assetId = null;
        if (thumbnailLink) {
          const href = thumbnailLink.getAttribute('href');
          const match = href.match(/\/game-pass\/(\d+)\//);
          if (match) {
            assetId = match[1];
          }
        }
        
        let thumbnail = '';
        const thumbnailImg = storeCard.querySelector('.gear-passes-asset img');
        if (thumbnailImg) {
          const originalSrc = thumbnailImg.getAttribute('src');
          thumbnail = originalSrc.replace(/\/150\/150\//, '/420/420/');
        }
        
        const cashbackRate = 0.05;
        const baseAmount = price * cashbackRate;
        const finalAmount = Math.floor(baseAmount * 0.70);
        
        const minPrice = 40;
        const isEligible = price >= minPrice && finalAmount >= 1;
                
        const originalIcon = document.querySelector('.icon-robux-16x16');
        const robuxIcon = originalIcon ? originalIcon.cloneNode(true) : document.createElement('span');
        if (originalIcon) {
          robuxIcon.style.display = 'inline-block';
          robuxIcon.style.marginLeft = '2px';
          robuxIcon.style.marginRight = '0px';
          robuxIcon.style.filter = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))';
        }
        
        const cashbackButton = document.createElement('button');
        cashbackButton.className = 'btn-buy-md btn-full-width roearn-gamepass-cashback-button';
        cashbackButton.type = 'button';
        
        if (!isEligible) {
          originalButton.setAttribute('data-roearn-not-eligible', 'true');
          
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
          
          const tooltip = document.createElement('div');
          tooltip.className = 'roearn-gamepass-tooltip';
          tooltip.textContent = getMessage("tooltipGamepassMinPriceShort");
          tooltip.style.cssText = `
            position: fixed;
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
            z-index: 10000;
            pointer-events: none;
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
          
          document.body.appendChild(tooltip);
          
          infoIcon.addEventListener('mouseenter', () => {
            const iconRect = infoIcon.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            tooltip.style.left = (iconRect.left + iconRect.width / 2 - tooltipRect.width / 2) + 'px';
            tooltip.style.top = (iconRect.top - tooltipRect.height - 10) + 'px';
            
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
          cashbackButton.classList.add('roearn-gamepass-not-eligible');
          
          cashbackButton.style.background = '#6c757d';
          cashbackButton.style.height = '50px';
          cashbackButton.style.border = 'none';
          cashbackButton.style.borderRadius = '8px';
          cashbackButton.style.color = 'white';
          cashbackButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
          cashbackButton.style.fontWeight = 'bold';
          cashbackButton.style.cursor = 'not-allowed';
          cashbackButton.style.display = 'flex';
          cashbackButton.style.alignItems = 'center';
          cashbackButton.style.justifyContent = 'center';
          cashbackButton.style.marginBottom = '12px';
          
          cashbackButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          });
          
        } else {
          const buyText = document.createElement('div');
          buyText.textContent = getMessage("buy");
          buyText.style.width = '100%';
          buyText.style.textAlign = 'center';
          buyText.style.fontSize = '16.8px';
          buyText.style.fontWeight = 'bold';
          
          const earnText = document.createElement('div');
          earnText.style.display = 'flex';
          earnText.style.alignItems = 'center';
          earnText.style.justifyContent = 'center';
          earnText.style.width = '100%';
          earnText.style.fontSize = '14px';
          
          const rawTemplate = cachedMessages?.earnAmount?.message || "(Earn $1)";
          const parts = rawTemplate.split("$1");
          earnText.appendChild(document.createTextNode(parts[0]));
          earnText.appendChild(robuxIcon);
          earnText.appendChild(document.createTextNode(" " + finalAmount + (parts[1] || "")));
          
          cashbackButton.appendChild(buyText);
          cashbackButton.appendChild(earnText);
          cashbackButton.style.flexDirection = 'column';
          cashbackButton.style.gap = '2px';
          
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
          cashbackButton.style.height = '50px';
          cashbackButton.style.border = 'none';
          cashbackButton.style.borderRadius = '8px';
          cashbackButton.style.color = 'white';
          cashbackButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)';
          cashbackButton.style.fontWeight = 'bold';
          cashbackButton.style.display = 'flex';
          cashbackButton.style.alignItems = 'center';
          cashbackButton.style.justifyContent = 'center';
          cashbackButton.style.fontSize = '14px';
          cashbackButton.style.marginBottom = '12px';
          cashbackButton.style.cursor = 'pointer';
          
          cashbackButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
                        
            if (!thumbnail || !assetId) {
              return;
            }
            
            window.dispatchEvent(new CustomEvent('roearn:showCheckout', {
              detail: {
                thumbnail: thumbnail,
                assetName: assetName,
                assetId: String(assetId),
                assetType: 'gamepass',
                userId: String(userId),
                earnAmount: finalAmount,
                assetPrice: price
              }
            }));
          }, true);
        }
        
        footer.insertBefore(cashbackButton, originalButton);
      });

    } catch (error) {
    } finally {
      isAddingButtons = false;
    }
  }

  function checkAndAddButtons() {
    const isOnStoreTab = window.location.hash.includes('store') || 
                         document.querySelector('#tab-store.active') !== null ||
                         document.querySelector('.tab-pane.store.active') !== null;
    if (isOnStoreTab) {
      addGamePassCashbackButtons();
    }
  }

  checkAndAddButtons();
  
  setTimeout(checkAndAddButtons, 100);
  setTimeout(checkAndAddButtons, 300);

  window.addEventListener('hashchange', () => {
    if (currentAbortController) {
      currentAbortController.abort();
    }
    
    checkAndAddButtons();
  });

  let lastHash = window.location.hash;
  new MutationObserver(() => {
    const currentHash = window.location.hash;
    if (currentHash !== lastHash) {
      lastHash = currentHash;
      checkAndAddButtons();
    }
  }).observe(document.body, { subtree: true, childList: true });
})();