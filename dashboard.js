(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    (function injectHideCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'roearn-panel-hide-style';
            style.textContent = `
                #content {
                    visibility: hidden !important;
                }
                #content.roearn-panel-ready {
                    visibility: visible !important;
                }
                    
            `;
            document.head.appendChild(style);
        } else {
            const headObserver = new MutationObserver(() => {
                if (document.head) {
                    headObserver.disconnect();
                    const style = document.createElement('style');
                    style.id = 'roearn-panel-hide-style';
                    style.textContent = `
                        #content {
                            visibility: hidden !important;
                        }
                        #content.roearn-panel-ready {
                            visibility: visible !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            });
            headObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
    })();

    let cachedMessages = null;
    let messagesPromise = null;
    let cachedLocale = 'en';
    let announcementData = null;

    const localeMapping = {
        'en_us': 'en',
        'id_id': 'id',
        'de_de': 'de',
        'es_es': 'es',
        'fr_fr': 'fr',
        'it_it': 'it',
        'pl_pl': 'pl',
        'pt_br': 'pt_BR',
        'vi_vn': 'vi',
        'tr_tr': 'tr',
        'th_th': 'th',
        'zh_cn': 'zh_CN',
        'zh_tw': 'zh_TW',
        'ja_jp': 'ja',
        'ko_kr': 'ko',
        'ar_001': 'ar'
    };

    async function fetchAnnouncementBanner() {
        return new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_ANNOUNCEMENT' },
                (response) => {
                    if (response && response.success) {
                        announcementData = response;
                    } else {
                        announcementData = null;
                    }
                    resolve();
                }
            );
        });
    }

    function createAnnouncementBanner() {
        if (!announcementData || !announcementData.enabled) {
            return null;
        }
        
        const mappedLocale = localeMapping[cachedLocale.toLowerCase()] || 'en';
        const message = announcementData.messages[mappedLocale] || announcementData.messages['en'];
        
        if (!message) {
            return null;
        }
        
        const banner = document.createElement('div');
        banner.className = 'roearn-announcement-banner';
        banner.innerHTML = `
            <div class="roearn-announcement-icon">📢</div>
            <div class="roearn-announcement-text">${message}</div>
        `;
        
        return banner;
    }


    async function loadMessages() {
        if (cachedMessages) return cachedMessages;
        if (messagesPromise) return messagesPromise;
        
        messagesPromise = (async () => {
            let locale = 'en';
            
            try {
                const result = await api.storage.local.get(['userLocale']);
                locale = result.userLocale || 'en';
            } catch (e) {}

            cachedLocale = locale;
            
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

    const setTitle = () => {
        document.title = getMessage("dashboardPageTitle");
    };

    setTitle();

    const spamInterval = setInterval(setTitle, 1);
    setTimeout(() => clearInterval(spamInterval), 1000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTitle();
        });
    }

    window.addEventListener('load', () => {
        setTitle();
    });
    
    let cachedBalance = null;
    let cachedUserData = null;

    function userIdToReferralCode(userId) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const base = alphabet.length;
        let num = parseInt(userId);
        
        if (num === 0) return 'A';
        
        num = num + 1;
        
        let result = '';
        while (num > 0) {
            num = num - 1;
            result = alphabet[num % base] + result;
            num = Math.floor(num / base);
        }
        
        return result;
    }
    
    async function getAuthenticatedUser() {
        if (cachedUserData) {
            return cachedUserData;
        }

        try {
            const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
                credentials: 'include'
            });
            
            if (response.status === 401) {
                window.location.href = 'https://www.roblox.com/login?returnUrl=https%3A%2F%2Fwww.roblox.com%2Froearn';
                return null;
            }
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            cachedUserData = {
                id: data.id,
                name: data.name
            };
            return cachedUserData;
        } catch (error) {
            return null;
        }
    }

    async function getBalance(userId) {
        return new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_BALANCE', userId: userId },
                (response) => {
                    if (response && response.success) {
                        resolve(response.balance);
                    } else {
                        resolve(0);
                    }
                }
            );
        });
    }
    async function refreshBalance() {
        const userData = await getAuthenticatedUser();
        
        if (userData) {
            const newBalance = await getBalance(userData.id);
            cachedBalance = newBalance;
            
            const balanceAmountElement = document.querySelector('.roearn-balance-amount');
            if (balanceAmountElement) {
                balanceAmountElement.innerHTML = `
                    <span class="icon-robux-16x16" style="margin-top: 6px; margin-right: 6px;"></span>
                    ${newBalance.toLocaleString()}
                `;
            }
        }
    }

    window.addEventListener('roearn:refetchBalance', async () => {
        await refreshBalance();
    });

    async function createReferralVerificationGamepass() {
        try {
            const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
                credentials: 'include'
            });
            
            if (!userResponse.ok) {
                return { success: false, error: getMessage("errorAuthFailed") };
            }
            
            let userData;
            try {
                userData = await userResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorAuthRetry") };
            }
            
            const userId = userData.id;
            
            const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/places/inventory?cursor=&itemsPerPage=100&placesTab=Created`;
            const inventoryResponse = await fetch(inventoryUrl, {
                credentials: 'include'
            });
            
            if (!inventoryResponse.ok) {
                return { success: false, error: getMessage("errorFetchGames") };
            }
            
            let inventoryData;
            try {
                inventoryData = await inventoryResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorFetchGamesRetry") };
            }
            
            if (!inventoryData.data || inventoryData.data.length === 0) {
                return { success: false, error: getMessage("errorNoGames") };
            }
            
            const firstGame = inventoryData.data[0];
            const gameData = {
                universeId: firstGame.universeId,
                placeId: firstGame.placeId,
                userId: userId
            };
            
            const xsrfResponse = await fetch('https://auth.roblox.com/v2/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            const xsrfToken = xsrfResponse.headers.get('x-csrf-token');
            
            if (!xsrfToken) {
                return { success: false, error: getMessage("errorSecurityToken") };
            }
            
            const referralDescription = 'Do NOT create this gamepass manually. Anyone telling you to do so is trying to steal your referral. This gamepass was created automatically. If someone tells you to change your gamepass description to this, you are being scammed—do not listen to them.';
            
            const formData = new FormData();
            formData.append('name', 'Referral');
            formData.append('description', referralDescription);
            formData.append('universeId', gameData.universeId);
            
            const gamepassResponse = await fetch('https://apis.roblox.com/game-passes/v1/game-passes', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'x-csrf-token': xsrfToken
                },
                body: formData
            });
            
            let gamepassData;
            try {
                gamepassData = await gamepassResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorCreateGamepass") };
            }
            
            if (gamepassResponse.status === 200) {
                const gamePassId = gamepassData.gamePassId;
                
                const detailsFormData = new FormData();
                detailsFormData.append('name', 'Referral');
                detailsFormData.append('description', referralDescription);
                
                const detailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/${gamePassId}/details`, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'x-csrf-token': xsrfToken
                    },
                    body: detailsFormData
                });
                
                if (detailsResponse.status !== 200) {
                    let detailsResponseData;
                    try {
                        detailsResponseData = await detailsResponse.json();
                    } catch (jsonError) {
                        return { success: false, error: getMessage("errorUpdateGamepass") };
                    }
                    
                    if (detailsResponseData.errorCode === 'InternalError') {
                        let existingGamepass = null;
                        let cursor = null;
                        
                        while (!existingGamepass) {
                            const cursorParam = cursor ? `&cursor=${cursor}` : '';
                            const existingGamepassesResponse = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/universes/${gameData.universeId}/creator?count=100${cursorParam}`, {
                                credentials: 'include'
                            });
                            
                            if (!existingGamepassesResponse.ok) {
                                return { success: false, error: getMessage("errorFetchGamepasses") };
                            }
                            
                            let existingGamepassesData;
                            try {
                                existingGamepassesData = await existingGamepassesResponse.json();
                            } catch (jsonError) {
                                return { success: false, error: getMessage("errorFetchGamepasses") };
                            }
                            
                            if (existingGamepassesData.gamePasses && existingGamepassesData.gamePasses.length > 0) {
                                existingGamepass = existingGamepassesData.gamePasses[0];
                                break;
                            }
                            
                            if (existingGamepassesData.cursor) {
                                cursor = existingGamepassesData.cursor;
                            } else {
                                break;
                            }
                        }
                        
                        if (!existingGamepass) {
                            return { success: false, error: getMessage("errorNoGamepasses") };
                        }
                        
                        const reusedGamePassId = existingGamepass.gamePassId;
                        
                        const reusedDetailsFormData = new FormData();
                        reusedDetailsFormData.append('name', 'Referral');
                        reusedDetailsFormData.append('description', referralDescription);
                        
                        const reusedDetailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/${reusedGamePassId}/details`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: {
                                'x-csrf-token': xsrfToken
                            },
                            body: reusedDetailsFormData
                        });
                        
                        if (reusedDetailsResponse.status !== 200) {
                            return { success: false, error: getMessage("errorUpdateVerification") };
                        }
                        
                        return {
                            success: true,
                            gamePassId: reusedGamePassId,
                            userId: gameData.userId
                        };
                    } else {
                        return { success: false, error: getMessage("errorUpdateGamepass") };
                    }
                }
                
                return {
                    success: true,
                    gamePassId: gamePassId,
                    userId: gameData.userId
                };
                
            } else {
                return { success: false, error: getMessage("errorCreateGamepass") };
            }
            
        } catch (error) {
            return { success: false, error: getMessage("errorUnexpected") };
        }
    }

    function injectHideCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'roearn-panel-hide-style';
            style.textContent = `
                #content {
                    visibility: hidden !important;
                }
                #content.roearn-panel-ready {
                    visibility: visible !important;
                }
                
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
                
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                .roearn-announcement-banner {
                    background: white;
                    border-radius: 12px;
                    padding: 12px 20px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: fit-content;
                    margin: 0 auto 30px auto;
                }

                .dark-theme .roearn-announcement-banner {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }

                .roearn-announcement-icon {
                    font-size: 20px;
                    flex-shrink: 0;
                }

                .roearn-announcement-text {
                    font-size: 14px;
                    font-weight: 500;
                    color: #393b3d;
                    line-height: 1.4;
                }

                .dark-theme .roearn-announcement-text {
                    color: #ffffff;
                }

                .roearn-reload-icon {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    opacity: 0.6;
                }
                
                .roearn-reload-icon:hover {
                    opacity: 1;
                }
                
                .roearn-reload-icon.spinning {
                    animation: spin 0.6s linear;
                }
                
                .roearn-reload-icon svg {
                    width: 100%;
                    height: 100%;
                    fill: #393b3d;
                }
                
                .dark-theme .roearn-reload-icon svg {
                    fill: #ffffff;
                }
                
                .roearn-panel-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-page-background {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                }
                
                .roearn-panel-container > * {
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-panel-container > * {
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-floating-coin {
                    position: absolute;
                    opacity: 0;
                    pointer-events: none;
                    animation: coinEntrance 1.2s ease-out forwards, float 6s ease-in-out infinite;
                    animation-delay: var(--entrance-delay, 0s), calc(var(--entrance-delay, 0s) + 1.2s);
                    transform: scale(var(--coin-scale, 1));
                    transform-origin: center center;
                }
                
                .roearn-floating-coin.gradient-1 {
                    filter: brightness(0) saturate(100%) invert(71%) sepia(48%) saturate(1290%) hue-rotate(181deg) brightness(103%) contrast(101%) drop-shadow(0 0 12px rgba(107, 181, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-2 {
                    filter: brightness(0) saturate(100%) invert(56%) sepia(60%) saturate(2384%) hue-rotate(225deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(166, 107, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-3 {
                    filter: brightness(0) saturate(100%) invert(63%) sepia(72%) saturate(2548%) hue-rotate(261deg) brightness(102%) contrast(101%) drop-shadow(0 0 12px rgba(214, 107, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-4 {
                    filter: brightness(0) saturate(100%) invert(65%) sepia(77%) saturate(2701%) hue-rotate(302deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(255, 107, 189, 0.6));
                }
                
                @keyframes float {
                    0%, 100% {
                        transform: translateY(0) rotate(0deg) scale(var(--coin-scale, 1));
                    }
                    25% {
                        transform: translateY(-15px) rotate(5deg) scale(var(--coin-scale, 1));
                    }
                    50% {
                        transform: translateY(-10px) rotate(-5deg) scale(var(--coin-scale, 1));
                    }
                    75% {
                        transform: translateY(-20px) rotate(3deg) scale(var(--coin-scale, 1));
                    }
                }
                
                @keyframes coinEntrance {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                    }
                    60% {
                        opacity: 0.3;
                    }
                    100% {
                        opacity: 0.25;
                        transform: translate(0, 0) scale(var(--coin-scale, 1)) rotate(0deg);
                    }
                }
                
                .dark-theme @keyframes coinEntrance {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) scale(0) rotate(0deg);
                    }
                    60% {
                        opacity: 0.35;
                    }
                    100% {
                        opacity: 0.3;
                        transform: translate(0, 0) scale(var(--coin-scale, 1)) rotate(0deg);
                    }
                }
                
                .roearn-panel-header {
                    text-align: center;
                    margin-bottom: 50px;
                }
                
                .roearn-panel-title {
                    font-size: 48px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-panel-title {
                    color: #ffffff;
                }
                
                .roearn-panel-subtitle {
                    font-size: 19px;
                    color: #606162;
                }
                
                .dark-theme .roearn-panel-subtitle {
                    color: #d1d1d1;
                }
                
                .roearn-balance-section {
                    background: white;
                    border-radius: 12px;
                    padding: 15px 20px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: auto;
                    max-height: 250px;
                }
                
                .dark-theme .roearn-balance-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-balance-label {
                    font-size: 26px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 5px;
                    text-align: center;
                }
                
                .dark-theme .roearn-balance-label {
                    color: #ffffff;
                }
                
                .dark-theme .roearn-balance-label[style*="color: #00a82d"] {
                    color: #00a82d !important;
                }
                
                .dark-theme .roearn-success-message {
                    color: #ffffff !important;
                }
                
                .roearn-balance-amount {
                    font-size: 56px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-balance-amount {
                    color: #ffffff;
                }
                
                .roearn-balance-amount .icon-robux-16x16 {
                    transform: scale(2.5);
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: crisp-edges;
                }
                
                .dark-theme .roearn-balance-amount .icon-robux-16x16 {
                    filter: brightness(0) invert(1);
                }
                
                .roearn-withdraw-button {
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    display: block;
                    padding: 0;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    height: 52px;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-withdraw-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-withdraw-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                
                .roearn-error-message {
                    color: #dc3545;
                    font-size: 14px;
                    margin-top: 12px;
                    text-align: center;
                    opacity: 0;
                    max-height: 0;
                    overflow: hidden;
                    transition: opacity 0.3s ease-out, max-height 0.3s ease-out;
                    position: absolute;
                    bottom: 20px;
                    left: 0;
                    right: 0;
                    width: 100%;
                }
                
                .roearn-error-message.show {
                    opacity: 1;
                    max-height: 100px;
                }
                
                .roearn-error-message a {
                    color: #dc3545;
                    text-decoration: underline;
                }
                
                .dark-theme .roearn-error-message {
                    color: #ff6b6b;
                }
                
                .dark-theme .roearn-error-message a {
                    color: #ff6b6b;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .roearn-two-column {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 40px;
                }
                
                @media (max-width: 900px) {
                    .roearn-two-column {
                        grid-template-columns: 1fr;
                    }
                }
                
                .roearn-balance-section {
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    opacity: 1 !important;
                }
                
                .dark-theme .roearn-balance-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                
                .roearn-referral-section {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1 !important;
                    position: relative;
                    overflow: hidden;
                    max-height: 630px;
                }

                .dark-theme .roearn-referral-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                
                .roearn-referral-list-section {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1 !important;
                    position: relative;
                    overflow: hidden;
                    margin-top: 0;
                }
                
                .roearn-two-column.has-referrals {
                    margin-bottom: 0;
                }
                
                .roearn-referral-list-section {
                    border-top-left-radius: 0;
                    border-top-right-radius: 0;
                }
                
                .roearn-referral-section.has-referrals {
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                    margin-bottom: 0;
                }
                
                .dark-theme .roearn-referral-list-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }

                .dark-theme .roearn-referral-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                                
                .roearn-section-title {
                    font-size: 26px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-section-title {
                    color: #ffffff;
                }
                
                .roearn-referral-code-container {
                    background: #f8f8f8;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                
                .dark-theme .roearn-referral-code-container {
                    background: #2e3031;
                }
                
                .roearn-referral-code-label {
                    font-size: 14px;
                    color: #606162;
                    margin-bottom: 10px;
                }
                
                .dark-theme .roearn-referral-code-label {
                    color: #d1d1d1;
                }
                
                .roearn-referral-code {
                    font-size: 28px;
                    font-weight: bold;
                    color: #393b3d;
                    letter-spacing: 2px;
                    font-family: 'Courier New', monospace;
                }
                
                .dark-theme .roearn-referral-code {
                    color: #ffffff;
                }
                
                .roearn-referral-copy-button {
                    width: 100%;
                    padding: 12px;
                    margin-top: 15px;
                    background: #00a82d;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                }
                
                .roearn-referral-copy-button:hover {
                    transform: translateY(-1px);
                }
                
                .roearn-referral-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 25px;
                }
                
                .roearn-referral-stat {
                    text-align: center;
                }
                
                .roearn-referral-stat-value {
                    font-size: 32px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }
                
                .dark-theme .roearn-referral-stat-value {
                    color: #ffffff;
                }
                
                .roearn-referral-stat-label {
                    font-size: 14px;
                    color: #606162;
                }
                
                .dark-theme .roearn-referral-stat-label {
                    color: #ffffff;
                }
                
                .roearn-referral-description {
                    padding: 20px;
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.1), rgba(255, 107, 189, 0.1));
                    border-radius: 8px;
                    text-align: left;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #393b3d;
                    position: relative;
                }
                
                .dark-theme .roearn-referral-description {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.05), rgba(255, 107, 189, 0.05));
                    color: #d1d1d1;
                }
                
                .roearn-referral-highlight {
                    font-weight: bold;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .roearn-view-referrals-button {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-view-referrals-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-referral-list-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    margin-top: 10px;
                }
                
                .roearn-sort-dropdown {
                    background: #f8f8f8;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #393b3d;
                    cursor: pointer;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                .dark-theme .roearn-sort-dropdown {
                    background: #2e3031;
                    border-color: #3e4041;
                    color: #ffffff;
                }
                
                .roearn-sort-dropdown:hover {
                    border-color: rgb(166, 107, 255);
                }
                
               .roearn-referral-list-container {
                    max-height: 175px;
                    overflow-y: auto;
                    margin-bottom: 20px;
                    padding-right: 8px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar {
                    width: 8px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                
                .dark-theme .roearn-referral-list-container::-webkit-scrollbar-track {
                    background: #2e3031;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                
                .roearn-referral-item {
                    background: #f8f8f8;
                    border-radius: 8px;
                    padding: 15px 20px;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .dark-theme .roearn-referral-item {
                    background: #2e3031;
                }
                
                .roearn-referral-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    object-fit: cover;
                    cursor: pointer;
                    transition: transform 0.2s;
                    flex-shrink: 0;
                }
                
                .roearn-referral-avatar:hover {
                    transform: scale(1.1);
                }
                
                .roearn-referral-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                    min-width: 0;
                }
                
                .roearn-referral-item-username {
                    font-size: 16px;
                    font-weight: bold;
                    color: #393b3d;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dark-theme .roearn-referral-item-username {
                    color: #ffffff;
                }
                                
                .roearn-referral-item-displayname {
                    font-size: 14px;
                    color: #606162;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .dark-theme .roearn-referral-item-displayname {
                    color: #d1d1d1;
                }
                
                .roearn-referral-item-timestamp {
                    font-size: 13px;
                    color: #606162;
                    margin-left: auto;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                
                .dark-theme .roearn-referral-item-timestamp {
                    color: #d1d1d1;
                }

                .roearn-pending-notice {
                    text-align: center;
                    font-size: 14.5px;
                    color: #393b3d;
                    margin-top: 12px;
                    font-weight: 600;
                    opacity: 0;
                    max-height: 0;
                    overflow: hidden;
                    transition: opacity 0.3s ease-out, max-height 0.3s ease-out;
                }

                .roearn-pending-notice.show {
                    opacity: 1;
                    max-height: 50px;
                }

                .dark-theme .roearn-pending-notice {
                    color: #ffffff;
                }
                
                .roearn-referral-loading {
                    text-align: center;
                    padding: 40px;
                    color: #606162;
                    font-size: 16px;
                }
                
                .dark-theme .roearn-referral-loading {
                    color: #d1d1d1;
                }
                
                .roearn-play-button {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    transition: transform 0.2s, opacity 0.3s ease;
                    filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5));
                }

                .roearn-play-button.roearn-controls-hidden {
                    opacity: 0;
                    pointer-events: none;
                }

                .roearn-play-button svg {
                    fill: url(#playGradient);
                }

                .roearn-play-button:hover {
                    transform: translate(-50%, -50%) scale(1.1);
                }

                .roearn-video-controls {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 100;
                    user-select: none;
                    -webkit-user-select: none;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                }

                .roearn-video-controls.roearn-controls-hidden {
                    opacity: 0;
                }

                .roearn-control-btn {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.9;
                    transition: opacity 0.2s;
                }

                .roearn-control-btn:hover {
                    opacity: 1;
                }

                .roearn-time-display {
                    color: white;
                    font-size: 13px;
                    font-weight: 500;
                    min-width: 90px;
                }

                .roearn-progress-container {
                    flex: 1;
                }

                .roearn-progress-bar {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                    cursor: pointer;
                    position: relative;
                }

                .roearn-progress-fill {
                    height: 100%;
                    background: white;
                    border-radius: 3px;
                    width: 0%;
                    transition: width 0.1s;
                }

                .roearn-progress-bar:hover .roearn-progress-fill {
                    background: rgb(166, 107, 255);
                }
                .roearn-back-button {
                    position: absolute;
                    top: 30px;
                    left: 30px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s, transform 0.2s;
                }
                
                .roearn-back-button:hover {
                    background: #5a6268;
                    transform: translateY(-1px);
                }
                
                .roearn-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                
                .roearn-modal-overlay.show {
                    opacity: 1;
                }
                
                .roearn-modal {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.9);
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    max-width: 500px;
                    width: 90%;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                    transition: transform 0.3s;
                }
                
                .dark-theme .roearn-modal {
                    background: #232527;
                }
                
                .roearn-modal-overlay.show .roearn-modal {
                    transform: translate(-50%, -50%) scale(1);
                }
                
                .roearn-modal-title {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    text-align: center;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-modal-title {
                    color: #bdbebe;
                }
                
                .roearn-modal-content {
                    margin-bottom: 30px;
                    text-align: center;
                }
                
                .roearn-modal-balance {
                    font-size: 42px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin: 20px 0;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-modal-balance {
                    color: #bdbebe;
                }
                
                .roearn-modal-balance .icon-robux-16x16 {
                    transform: scale(2);
                }
                
                .roearn-modal-text {
                    font-size: 16px;
                    color: #606162;
                    line-height: 1.6;
                }
                
                .dark-theme .roearn-modal-text {
                    color: #949596;
                }
                
                .roearn-modal-buttons {
                    display: flex;
                    gap: 15px;
                }
                
                .roearn-modal-button {
                    flex: 1;
                    padding: 14px;
                    border: none;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-modal-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-modal-button-confirm {
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.5) 0px 1px 2px;
                }
                
                .roearn-modal-button-cancel {
                    background: #6c757d;
                    color: white;
                }
                
                .roearn-modal-button-cancel:hover {
                    background: #5a6268;
                }
                
                .roearn-onboarding-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-top: 30px;
                    align-items: start;
                }
                
                @media (max-width: 1000px) {
                    .roearn-onboarding-container {
                        grid-template-columns: 1fr;
                    }
                }
                
                .roearn-onboarding-video-section {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .roearn-onboarding-video-container {
                    user-select: none;
                    -webkit-user-select: none;
                    width: 100%;
                    max-width: 640px;
                    position: relative;
                    padding-bottom: 56.25%;
                    height: 0;
                    overflow: hidden;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    background: #000;
                }
                                
                .roearn-onboarding-video {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                }
                
                .roearn-referral-entry-card {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .dark-theme .roearn-referral-entry-card {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-referral-entry-title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 15px;
                }
                
                .dark-theme .roearn-referral-entry-title {
                    color: #ffffff;
                }
                
                .roearn-referral-entry-description {
                    font-size: 16px;
                    color: #606162;
                    margin-bottom: 30px;
                }
                
                .dark-theme .roearn-referral-entry-description {
                    color: #d1d1d1;
                }
                
                .roearn-referral-input-container {
                    margin-bottom: 30px;
                    position: relative;
                }
                
                .roearn-referral-input {
                    width: 100%;
                    max-width: 400px;
                    padding: 15px 60px 15px 20px;
                    font-size: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    text-align: center;
                    font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    font-weight: 700;
                    outline: none;
                    transition: border-color 0.2s;
                    background: #f5f5f5;
                }

                .roearn-referral-input::placeholder {
                    text-align: center;
                }
                
                .roearn-referral-input-error {
                    border-color: #dc3545 !important;
                }
                
                .roearn-referral-error {
                    color: #dc3545;
                    font-size: 14px;
                    margin-top: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    white-space: nowrap;
                }
                
                .roearn-referral-error.show {
                    opacity: 1;
                }
                
                .roearn-referral-input:focus {
                    border-color: rgb(166, 107, 255);
                }
                
                .dark-theme .roearn-referral-input {
                    background: #2e3031;
                    border-color: #3e4041;
                    color: #ffffff;
                }
                
                .dark-theme .roearn-referral-input:focus {
                    border-color: rgb(166, 107, 255);
                }
                
                .roearn-referral-button-container {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                
                .roearn-referral-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-referral-continue-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-referral-skip-button {
                    padding: 14px 40px;
                    background: #6c757d;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s, background 0.2s;
                }
                
                .roearn-referral-skip-button:hover {
                    background: #5a6268;
                    transform: translateY(-2px);
                }
                
                .roearn-start-button-container {
                    display: flex;
                    justify-content: center;
                    margin-top: 30px;
                }
                
                .roearn-start-button {
                    padding: 16px 50px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-start-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-tutorial-slide {
                    background: white;
                    border-radius: 12px;
                    padding: 0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    margin-top: 30px;
                    overflow: hidden;
                    max-width: 1100px;
                    margin-left: auto;
                    margin-right: auto;
                    min-height: 500px;
                }
                
                .dark-theme .roearn-tutorial-slide {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-tutorial-content-side {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.08), rgba(255, 107, 189, 0.08));
                    padding: 50px 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 30px;
                    position: relative;
                }
                
                .dark-theme .roearn-balance-section div[style*="color: #393b3d"] {
                    color: #ffffff !important;
                }

                .dark-theme .roearn-balance-section div[style*="color: #606162"] {
                    color: #d1d1d1 !important;
                }

                .dark-theme .roearn-tutorial-content-side {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.05), rgba(255, 107, 189, 0.05));
                }
                
                .roearn-tutorial-content-side::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: linear-gradient(180deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189));
                }
                
                .roearn-tutorial-text {
                    font-size: 18px;
                    line-height: 1.8;
                    color: #393b3d;
                    text-align: center;
                    max-width: 400px;
                }
                
                .dark-theme .roearn-tutorial-text {
                    color: #d1d1d1;
                }
                
                .roearn-tutorial-image-column {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    align-items: center;
                    width: 100%;
                }
                
                .roearn-tutorial-image-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    width: 100%;
                    height: 100%;
                    background: #fafafa;
                }
                
                .dark-theme .roearn-tutorial-image-container {
                    background: #1a1b1c;
                }
                
                .roearn-tutorial-image {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .dark-theme .roearn-tutorial-image {
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-tutorial-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-tutorial-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-tutorial-continue-button:hover {
                    transform: translateY(-2px);
                }
                
                @media (max-width: 900px) {
                    .roearn-tutorial-slide {
                        grid-template-columns: 1fr;
                        gap: 30px;
                    }
                    
                    .roearn-tutorial-image-container {
                        order: -1;
                    }
                }
            `;
            document.head.appendChild(style);
            return true;
        }
        return false;
    }

    if (!injectHideCSS()) {
        const headObserver = new MutationObserver(() => {
            if (injectHideCSS()) {
                headObserver.disconnect();
            }
        });
        headObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    let globalPrefetchedData = null;

    async function prefetchAllData() {        
        const userData = await getAuthenticatedUser();
        if (!userData) {
            return null;
        }

        const [balance, withdrawalBalance, referralStats] = await Promise.all([
            getBalance(userData.id),
            new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_BALANCE', userId: userData.id },
                    (response) => resolve(response?.success ? response.balance : 0)
                );
            }),
            new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_STATS', userId: userData.id },
                    (response) => {
                        if (response?.success) {
                            resolve({
                                totalEarnings: response.totalEarnings,
                                totalReferrals: response.totalReferrals
                            });
                        } else {
                            resolve({ totalEarnings: 0, totalReferrals: 0 });
                        }
                    }
                );
            })
        ]);

        cachedBalance = balance;

        const hasReferral = await new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'HAS_REFERRAL', userId: userData.id },
                (response) => resolve(response?.success ? response.hasReferral : false)
            );
        });

        const result = {
            userData,
            balance,
            withdrawalBalance,
            referralStats,
            referralCode: userIdToReferralCode(userData.id),
            hasReferral
        };

        if (referralStats.totalReferrals >= 1) {
            const referralList = await new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_LIST', userId: userData.id },
                    (response) => resolve(response?.success ? response.referrals : [])
                );
            });

            if (referralList.length > 0) {
                const userIds = referralList.map(r => parseInt(r.userId));
                const [userDataList, thumbnails] = await Promise.all([
                    fetchUserData(userIds),
                    fetchAvatarThumbnails(userIds)
                ]);

                result.referralData = {
                    referralList,
                    userDataList,
                    thumbnails
                };
            }
        }

        return result;
    }
        

        async function fetchUserData(userIds) {
            const batchSize = 100;
            const batches = [];
            
            for (let i = 0; i < userIds.length; i += batchSize) {
                batches.push(userIds.slice(i, i + batchSize));
            }
            
            const allUserData = [];
            
            for (const batch of batches) {
                try {
                    const response = await fetch('https://users.roblox.com/v1/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userIds: batch,
                            excludeBannedUsers: false
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        allUserData.push(...data.data);
                    }
                } catch (error) {
                }
            }
            
            return allUserData;
        }

        async function fetchAvatarThumbnails(userIds) {
            const batchSize = 90;
            const batches = [];
            
            for (let i = 0; i < userIds.length; i += batchSize) {
                batches.push(userIds.slice(i, i + batchSize));
            }
            
            const allThumbnails = {};
            
            for (const batch of batches) {
                try {
                    const payload = batch.map(userId => ({
                        requestId: `${userId}:undefined:AvatarHeadshot:150x150:webp:regular:0`,
                        type: "AvatarHeadShot",
                        targetId: userId,
                        format: "webp",
                        size: "150x150"
                    }));
                    
                    const response = await fetch('https://thumbnails.roblox.com/v1/batch', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        data.data.forEach(item => {
                            allThumbnails[item.targetId] = item.imageUrl;
                        });
                    }
                } catch (error) {
                }
            }
            
            return allThumbnails;
    }
        
    async function createRoEarnPanel() {
        const prefetchedData = globalPrefetchedData;
        let prefetchedReferralData = prefetchedData?.referralData || null;

        const tutorialCompleted = await new Promise((resolve) => {
            api.storage.local.get(['tutorialCompleted'], (result) => {
                resolve(result.tutorialCompleted === true);
            });
        });

        let showContentCreatorUI = await new Promise((resolve) => {
            api.storage.local.get(['showContentCreatorUI'], (result) => {
                resolve(result.showContentCreatorUI === true);
            });
        });

        if (prefetchedData && prefetchedData.referralStats.totalReferrals >= 1) {
            showContentCreatorUI = true;
            if (!await new Promise((resolve) => {
                api.storage.local.get(['showContentCreatorUI'], (result) => {
                    resolve(result.showContentCreatorUI === true);
                });
            })) {
                api.storage.local.set({ showContentCreatorUI: true });
            }
        }
        
        const panel = document.createElement('div');
        panel.className = 'roearn-panel-container';

        
        if (!tutorialCompleted) {
            const userData = await getAuthenticatedUser();
            let userHasReferral = false;
            if (userData) {
                userHasReferral = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'HAS_REFERRAL', userId: userData.id },
                        (response) => resolve(response?.success ? response.hasReferral : false)
                    );
                });
            }
            const header = document.createElement('div');
            header.className = 'roearn-panel-header';
            header.innerHTML = `
                <div class="roearn-panel-title">${getMessage("welcomeTitle")}</div>
                <div class="roearn-panel-subtitle">${getMessage("welcomeSubtitle")}</div>
            `;
            
            const onboardingContainer = document.createElement('div');
            onboardingContainer.className = 'roearn-onboarding-container';
            
            const videoSection = document.createElement('div');
            videoSection.className = 'roearn-onboarding-video-section';
            
            const videoContainer = document.createElement('div');
            videoContainer.className = 'roearn-onboarding-video-container';

            const video = document.createElement('video');
            video.className = 'roearn-onboarding-video';
            video.src = `https://roearn-videos.store/${cachedLocale}.mp4`;
            video.playsInline = true;
            video.preload = 'auto';
            video.disablePictureInPicture = true;
            video.controlsList = 'nodownload noplaybackrate nofullscreen';
            video.oncontextmenu = (e) => e.preventDefault();

            const playButton = document.createElement('div');
            playButton.className = 'roearn-play-button';
            playButton.innerHTML = `
                <svg width="120" height="120" viewBox="0 0 24 24">
                    <defs>
                        <linearGradient id="playGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:rgb(107, 181, 255)"/>
                            <stop offset="33%" style="stop-color:rgb(166, 107, 255)"/>
                            <stop offset="66%" style="stop-color:rgb(214, 107, 255)"/>
                            <stop offset="100%" style="stop-color:rgb(255, 107, 189)"/>
                        </linearGradient>
                    </defs>
                    <path d="M8 5v14l11-7z" fill="url(#playGradient)"/>
                </svg>
            `;

            const controls = document.createElement('div');
            controls.className = 'roearn-video-controls';

            const playPauseBtn = document.createElement('div');
            playPauseBtn.className = 'roearn-control-btn';
            playPauseBtn.innerHTML = `
                <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="white" style="display:none;">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
            `;

            const timeDisplay = document.createElement('div');
            timeDisplay.className = 'roearn-time-display';
            timeDisplay.textContent = '0:00 / 0:00';

            const progressContainer = document.createElement('div');
            progressContainer.className = 'roearn-progress-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'roearn-progress-bar';

            const progressFill = document.createElement('div');
            progressFill.className = 'roearn-progress-fill';

            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);

            controls.appendChild(playPauseBtn);
            controls.appendChild(timeDisplay);
            controls.appendChild(progressContainer);

            function formatTime(seconds) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }

            function updatePlayPauseIcons(playing) {
                playPauseBtn.querySelector('.play-icon').style.display = playing ? 'none' : 'block';
                playPauseBtn.querySelector('.pause-icon').style.display = playing ? 'block' : 'none';
            }

            let isDragging = false;
            let isHovering = false;
            let hasPlayed = false;

            function showControls() {
                controls.classList.remove('roearn-controls-hidden');
            }

            function hideControls() {
                controls.classList.add('roearn-controls-hidden');
            }

            function showPlayButton() {
                playButton.classList.remove('roearn-controls-hidden');
            }

            function hidePlayButton() {
                playButton.classList.add('roearn-controls-hidden');
            }

            function tryPlay() {
                if (video.readyState < 2) {
                    video.load();
                }
                video.play().catch(() => {
                    video.load();
                    video.play().catch(() => {});
                });
            }

            playButton.addEventListener('click', tryPlay);

            playPauseBtn.addEventListener('click', () => {
                if (video.paused) {
                    tryPlay();
                } else {
                    video.pause();
                }
            });

            video.addEventListener('click', () => {
                if (video.paused) {
                    tryPlay();
                } else {
                    video.pause();
                }
            });

            video.addEventListener('play', () => {
                hasPlayed = true;
                updatePlayPauseIcons(true);
                hidePlayButton();
                if (!isHovering) {
                    hideControls();
                }
            });

            video.addEventListener('pause', () => {
                updatePlayPauseIcons(false);
                showControls();
            });

            video.addEventListener('ended', () => {
                hasPlayed = false;
                updatePlayPauseIcons(false);
                showPlayButton();
                showControls();
            });

            video.addEventListener('error', () => {
                video.load();
            });

            video.addEventListener('stalled', () => {
                const currentTime = video.currentTime;
                video.load();
                video.currentTime = currentTime;
                if (hasPlayed && !video.paused) {
                    video.play().catch(() => {});
                }
            });

            video.addEventListener('timeupdate', () => {
                if (!video.duration || !isFinite(video.duration)) return;
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = `${percent}%`;
                timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
            });

            videoContainer.addEventListener('mouseenter', () => {
                isHovering = true;
                showControls();
            });

            videoContainer.addEventListener('mouseleave', () => {
                isHovering = false;
                if (!video.paused) {
                    hideControls();
                }
            });

            function seek(e) {
                if (!video.duration || !isFinite(video.duration)) return;
                const rect = progressBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                video.currentTime = percent * video.duration;
                progressFill.style.width = `${percent * 100}%`;
            }

            progressBar.addEventListener('mousedown', (e) => {
                isDragging = true;
                seek(e);
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    seek(e);
                }
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            videoContainer.appendChild(video);
            videoContainer.appendChild(playButton);
            videoContainer.appendChild(controls);
            videoSection.appendChild(videoContainer);
            
            const referralCard = document.createElement('div');
            referralCard.className = 'roearn-referral-entry-card';
            
            const referralTitle = document.createElement('div');
            referralTitle.className = 'roearn-referral-entry-title';
            referralTitle.textContent = getMessage("referralEntryTitle");

            const referralDescription = document.createElement('div');
            referralDescription.className = 'roearn-referral-entry-description';
            referralDescription.textContent = getMessage("referralEntryDescription");
                        
            const referralInputContainer = document.createElement('div');
            referralInputContainer.className = 'roearn-referral-input-container';
            
            const inputWrapper = document.createElement('div');
            inputWrapper.style.cssText = 'width: 100%; max-width: 400px; margin: 0 auto; position: relative;';

            const inputInnerWrapper = document.createElement('div');
            inputInnerWrapper.style.cssText = 'position: relative;';

            const referralInput = document.createElement('input');
            referralInput.type = 'text';
            referralInput.className = 'roearn-referral-input';
            referralInput.placeholder = getMessage("referralInputPlaceholder");
            referralInput.maxLength = 10;
            referralInput.style.paddingRight = '60px';
            referralInput.style.paddingLeft = '60px';

            const avatarContainer = document.createElement('div');
            avatarContainer.style.cssText = `
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                overflow: hidden;
                background: #e0e0e0;
                display: none;
                border: 2px solid #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;

            const avatarImg = document.createElement('img');
            avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            avatarContainer.appendChild(avatarImg);

            const usernameDisplay = document.createElement('div');
            usernameDisplay.style.cssText = `
                text-align: center;
                font-size: 14px;
                font-weight: 600;
                color: #606162;
                position: absolute;
                left: 0;
                right: 0;
                top: 100%;
                margin-top: 8px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s, visibility 0.2s;
            `;

            inputInnerWrapper.appendChild(referralInput);
            inputInnerWrapper.appendChild(avatarContainer);
            inputWrapper.appendChild(inputInnerWrapper);
            inputWrapper.appendChild(usernameDisplay);

            const errorMessage = document.createElement('div');
            errorMessage.className = 'roearn-referral-error';
            errorMessage.textContent = getMessage("errorInvalidReferralCode");
            
            function referralCodeToUserId(code) {
                const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const base = alphabet.length;
                let result = 0;
                
                for (let char of code) {
                    if (!alphabet.includes(char)) {
                        return null;
                    }
                }
                
                for (let i = 0; i < code.length; i++) {
                    result = result * base + alphabet.indexOf(code[i]) + 1;
                }
                
                return result - 1;
            }
            
            function validateReferralCode(code) {
                if (!code || code.trim() === '') {
                    return true;
                }
                
                const userId = referralCodeToUserId(code.toUpperCase());
                return userId !== null && userId >= 0;
            }
            
            referralInput.addEventListener('input', async () => {
                const code = referralInput.value.trim().toUpperCase();
                referralInput.value = code;
                
                if (code === '') {
                    referralInput.classList.remove('roearn-referral-input-error');
                    errorMessage.classList.remove('show');
                    avatarContainer.style.display = 'none';
                    usernameDisplay.style.opacity = '0';
                    usernameDisplay.style.visibility = 'hidden';
                    startButton.disabled = false;
                    startButton.style.opacity = '';
                    startButton.style.width = '';
                    startButton.style.height = '';
                    startButton.textContent = getMessage("startButton");
                } else if (!validateReferralCode(code)) {
                    referralInput.classList.add('roearn-referral-input-error');
                    errorMessage.textContent = getMessage("errorInvalidReferralCode");
                    errorMessage.classList.add('show');
                    avatarContainer.style.display = 'none';
                    usernameDisplay.style.opacity = '0';
                    usernameDisplay.style.visibility = 'hidden';
                    startButton.disabled = true;
                    startButton.style.opacity = '0.7';
                } else {
                    const referredUserId = referralCodeToUserId(code);
                    const currentUser = await getAuthenticatedUser();
                    
                    if (currentUser && referredUserId === currentUser.id) {
                        referralInput.classList.add('roearn-referral-input-error');
                        errorMessage.textContent = getMessage("errorOwnReferralCode");
                        errorMessage.classList.add('show');
                        avatarContainer.style.display = 'none';
                        usernameDisplay.style.opacity = '0';
                        usernameDisplay.style.visibility = 'hidden';
                        startButton.disabled = true;
                        startButton.style.opacity = '0.7';
                    } else {
                        referralInput.classList.remove('roearn-referral-input-error');
                        errorMessage.classList.remove('show');
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        
                        const userId = referralCodeToUserId(code);
                        try {
                            const [thumbnailResponse, userResponse] = await Promise.all([
                                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
                                fetch(`https://users.roblox.com/v1/users/${userId}`)
                            ]);
                            
                            const thumbnailData = await thumbnailResponse.json();
                            const userData = await userResponse.json();
                            
                            if (thumbnailData.data && thumbnailData.data.length > 0) {
                                avatarImg.src = thumbnailData.data[0].imageUrl;
                                avatarContainer.style.display = 'block';
                            }
                            
                            if (userData.displayName && userData.name) {
                                usernameDisplay.textContent = `${userData.displayName} (@${userData.name})`;
                                usernameDisplay.style.opacity = '1';
                                usernameDisplay.style.visibility = 'visible';
                            }
                        } catch (error) {
                            avatarContainer.style.display = 'none';
                            usernameDisplay.style.opacity = '0';
                            usernameDisplay.style.visibility = 'hidden';
                        }
                    }
                }
            });

            
            referralInputContainer.appendChild(inputWrapper);
            referralInputContainer.appendChild(errorMessage);

            const startButtonContainer = document.createElement('div');
            startButtonContainer.className = 'roearn-start-button-container';

            const startButton = document.createElement('button');
            startButton.className = 'roearn-start-button';
            startButton.textContent = getMessage("startButton");

            startButtonContainer.appendChild(startButton);
            
            const optionalText = document.createElement('div');
            optionalText.style.cssText = `
                text-align: center;
                font-size: 21px;
                font-weight: 600;
                color: #606162;
                margin-top: 30px;
                letter-spacing: 0.5px;
            `;
            optionalText.textContent = getMessage("optionalLabel");

            referralCard.appendChild(referralTitle);
            referralCard.appendChild(referralDescription);
            referralCard.appendChild(referralInputContainer);
            referralCard.appendChild(optionalText);
            
            if (!userHasReferral) {
                onboardingContainer.appendChild(videoSection);
                onboardingContainer.appendChild(referralCard);
            } else {
                onboardingContainer.style.gridTemplateColumns = '1fr';
                onboardingContainer.style.placeItems = 'center';
                videoSection.style.width = '100%';
                videoSection.style.maxWidth = '640px';
                onboardingContainer.appendChild(videoSection);
            }
            
            startButton.addEventListener('click', async () => {
                const code = userHasReferral ? '' : (referralInput.value.trim().toUpperCase() || 'BELUEGEE');
                
                const buttonWidth = startButton.offsetWidth;
                const buttonHeight = startButton.offsetHeight;
                startButton.style.width = buttonWidth + 'px';
                startButton.style.height = buttonHeight + 'px';
                startButton.disabled = true;
                startButton.textContent = getMessage("loadingText");
                startButton.style.opacity = '0.7';
                
                if (code && !validateReferralCode(code)) {
                    referralInput.classList.add('roearn-referral-input-error');
                    errorMessage.classList.add('show');
                    startButton.textContent = getMessage("startButton");
                    return;
                }
                
                const storageData = { tutorialCompleted: true };
                
                if (code && !userHasReferral) {
                    const gamepassResult = await createReferralVerificationGamepass();
                    
                    if (!gamepassResult.success) {
                        errorMessage.textContent = gamepassResult.error;
                        errorMessage.classList.add('show');
                        referralInput.classList.add('roearn-referral-input-error');
                        
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        return;
                    }
                    
                    const referralResult = await new Promise((resolve) => {
                        api.runtime.sendMessage({
                            type: 'SET_REFERRAL',
                            userId: gamepassResult.userId,
                            referralCode: code,
                            gamepassId: gamepassResult.gamePassId
                        }, (response) => {
                            if (response && response.success) {
                                resolve({ success: true });
                            } else {
                                resolve({ success: false, error: response?.error });
                            }
                        });
                    });
                    
                    if (!referralResult.success) {
                        let errorText = getMessage("errorSetReferralFailed");
                        if (referralResult.error === 'referral_already_set') {
                            errorText = getMessage("errorReferralAlreadyUsed");
                        } else if (referralResult.error === 'invalid_referral_code') {
                            errorText = getMessage("errorInvalidReferralCodeRetry");
                        } else if (referralResult.error === 'cannot_refer_yourself') {
                            errorText = getMessage("errorOwnReferralCode");
                        } else if (referralResult.error === 'wrong_creator' || referralResult.error === 'wrong_name' || referralResult.error === 'wrong_description') {
                            errorText = getMessage("errorVerificationFailed");
                        } else {
                            errorText += referralResult.error || getMessage("errorPleaseTryAgain");
                        }
                        
                        errorMessage.textContent = errorText;
                        errorMessage.classList.add('show');
                        referralInput.classList.add('roearn-referral-input-error');
                        
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        return;
                    }
                }
                
                await new Promise((resolve) => {
                    api.storage.local.set(storageData, resolve);
                });

                const oldBalance = globalPrefetchedData?.balance || 0;

                globalPrefetchedData = await prefetchAllData();
                
                const content = document.getElementById('content');
                const newPanel = await createRoEarnPanel();
                
                content.innerHTML = '';
                content.appendChild(newPanel);

                if (code && globalPrefetchedData.balance > oldBalance) {
                    const bonusPrompt = document.createElement('div');
                    bonusPrompt.className = 'roearn-bonus-prompt';
                    bonusPrompt.innerHTML = `
                        <div class="roearn-bonus-close">✕</div>
                        <div class="roearn-bonus-icon">🎉</div>
                        <div class="roearn-bonus-text">
                            ${getMessage("bonusAddedText")}
                        </div>
                    `;
                    
                    const bonusStyle = document.createElement('style');
                    bonusStyle.textContent = `
                        .roearn-bonus-prompt {
                            position: fixed;
                            bottom: 20px;
                            right: 20px;
                            background: white;
                            border-radius: 14px;
                            padding: 24px;
                            padding-right: 40px;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                            z-index: 10000;
                            max-width: 320px;
                            font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            animation: bonusSlideIn 0.3s ease-out;
                        }
                        
                        .dark-theme .roearn-bonus-prompt {
                            background: #232527;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                        }
                        
                        @keyframes bonusSlideIn {
                            from {
                                transform: translateX(400px);
                                opacity: 0;
                            }
                            to {
                                transform: translateX(0);
                                opacity: 1;
                            }
                        }
                        
                        .roearn-bonus-close {
                            position: absolute;
                            top: 12px;
                            right: 14px;
                            font-size: 18px;
                            color: #999;
                            cursor: pointer;
                            transition: color 0.2s;
                        }
                        
                        .roearn-bonus-close:hover {
                            color: #666;
                        }
                        
                        .dark-theme .roearn-bonus-close {
                            color: #666;
                        }
                        
                        .dark-theme .roearn-bonus-close:hover {
                            color: #999;
                        }
                        
                        .roearn-bonus-icon {
                            font-size: 32px;
                            text-align: center;
                            margin-bottom: 12px;
                        }
                        
                        .roearn-bonus-text {
                            font-size: 16px;
                            font-weight: 600;
                            color: #393b3d;
                            text-align: center;
                            line-height: 1.4;
                        }
                        
                        .dark-theme .roearn-bonus-text {
                            color: #ffffff;
                        }
                    `;
                    document.head.appendChild(bonusStyle);
                    
                    document.body.appendChild(bonusPrompt);
                    
                    bonusPrompt.querySelector('.roearn-bonus-close').addEventListener('click', () => {
                        bonusPrompt.style.animation = 'bonusSlideIn 0.3s ease-in reverse';
                        setTimeout(() => {
                            bonusPrompt.remove();
                        }, 300);
                    });
                    
                    setTimeout(() => {
                        if (bonusPrompt.parentNode) {
                            bonusPrompt.style.animation = 'bonusSlideIn 0.3s ease-in reverse';
                            setTimeout(() => {
                                bonusPrompt.remove();
                            }, 300);
                        }
                    }, 10000);
                }
            });
            
            panel.appendChild(header);
            
            const announcementBanner = createAnnouncementBanner();
            if (announcementBanner) {
                panel.appendChild(announcementBanner);
            }
            
            panel.appendChild(onboardingContainer);
            panel.appendChild(startButtonContainer);
            
            setTimeout(() => {
                prefetchAllData().then(data => {
                    globalPrefetchedData = data;
                });
            }, 2000);
            
            return panel;
        }
        
        const balance = prefetchedData.balance;
        const userData = prefetchedData.userData;
        const referralCode = prefetchedData.referralCode;
        const referralEarnings = prefetchedData.referralStats.totalEarnings;
        const referralUsers = prefetchedData.referralStats.totalReferrals;

        if (referralUsers >= 1) {
            if (!showContentCreatorUI) {
                api.storage.local.set({ showContentCreatorUI: true });
            }
            
            const leftColumnWrapper = document.querySelector('.roearn-two-column > div:first-child');
            const existingCreatorSection = leftColumnWrapper?.querySelector('.roearn-balance-section[style*="margin-top: 30px"]');
            
            if (leftColumnWrapper && !existingCreatorSection) {
                const contentCreatorSection = document.createElement('div');
                contentCreatorSection.className = 'roearn-balance-section';
                contentCreatorSection.style.marginTop = '30px';
                contentCreatorSection.style.position = 'relative';
                
                contentCreatorSection.innerHTML = `
                    <div class="roearn-section-title" style="margin-bottom: 10px;">${getMessage("contentCreatorTitle")}</div><br>
                    
                    <div style="padding: 0px 15px 15px 15px;">
                        <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                            <span>${getMessage("contentCreatorPayout").split('100 Robux')[0]}</span>
                            <span class="icon-robux-16x16"></span>
                            <span>100 ${getMessage("contentCreatorPayout").split('100 ')[1]}</span>
                        </div>
                        
                        <div style="text-align: center; color: #606162; font-size: 13px; line-height: 1.6; margin-bottom: 12px;">${getMessage("contentCreatorDescription")}</div>
                        
                        <div style="text-align: center; color: #606162; font-size: 15px; line-height: 1.6;">
                            ${getMessage("contentCreatorContact").split('creators@roearn.io')[0]}<a href="mailto:creators@roearn.io" style="color: rgba(43, 124, 218, 1); font-weight: 500; text-decoration: none;">creators@roearn.io</a>${getMessage("contentCreatorContact").split('creators@roearn.io')[1]}
                            <br>
                        </div>
                        <br>
                        <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                            <span>${getMessage("contentCreatorLink").split('"roearn.io"')[0]}</span>
                            <u style="text-underline-offset: 3px;">"roearn.io"</u>
                            <span>${getMessage("contentCreatorLink").split('"roearn.io"')[1]}</span>
                        </div>
                    </div>
                `;
                    
                leftColumnWrapper.appendChild(contentCreatorSection);
            }
        }
        
        const header = document.createElement('div');
        header.className = 'roearn-panel-header';
        header.innerHTML = `
            <div class="roearn-panel-title">${getMessage("dashboardTitle")}</div>
            <div class="roearn-panel-subtitle">${getMessage("dashboardSubtitle")}</div>
        `;
        
        const twoColumn = document.createElement('div');
        twoColumn.className = 'roearn-two-column';
        
        const balanceSection = document.createElement('div');
        balanceSection.className = 'roearn-balance-section';
        balanceSection.innerHTML = `
            <div class="roearn-reload-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
            </div>
            <div class="roearn-balance-label">${getMessage("yourBalanceLabel")}</div>
            <div class="roearn-balance-amount">
                <span class="icon-robux-16x16" style="margin-top: 6px; margin-right: 6px;"></span>
                ${balance.toLocaleString()}
            </div>
            <button class="roearn-withdraw-button">${getMessage("withdrawButton")}</button>
            <div class="roearn-pending-notice"></div>
            <div class="roearn-error-message"></div>
        `;
        
        const reloadIcon = balanceSection.querySelector('.roearn-reload-icon');
        let isRefreshing = false;

        const pendingNotice = balanceSection.querySelector('.roearn-pending-notice');
        
        api.runtime.sendMessage(
            { type: 'GET_MANUAL_REVIEWAL', userId: userData.id },
            (response) => {
                if (response && response.success && response.pending && response.items) {
                    let totalPendingRobux = 0;
                    
                    response.items.forEach(item => {
                        const cashback = item.price * (item.withdrawPercent / 100);
                        if (cashback >= 2) {
                            totalPendingRobux += Math.floor(cashback * 0.7);
                        }
                    });
                    
                    if (totalPendingRobux > 0) {
                        pendingNotice.textContent = getMessage("pendingRobuxNotice").replace("X", totalPendingRobux);
                        pendingNotice.classList.add('show');
                    }
                }
            }
        );
        
        reloadIcon.addEventListener('click', async () => {
            if (isRefreshing) return;
            
            isRefreshing = true;
            reloadIcon.classList.add('spinning');
            
            await refreshBalance();
            
            api.runtime.sendMessage(
                { type: 'GET_MANUAL_REVIEWAL', userId: userData.id },
                (response) => {
                    if (response && response.success && response.pending && response.items) {
                        let totalPendingRobux = 0;
                        
                        response.items.forEach(item => {
                            const cashback = item.price * (item.withdrawPercent / 100);
                            if (cashback >= 2) {
                                totalPendingRobux += Math.floor(cashback * 0.7);
                            }
                        });
                        
                        if (totalPendingRobux > 0) {
                            pendingNotice.textContent = getMessage("pendingRobuxNotice").replace("X", totalPendingRobux);
                            pendingNotice.classList.add('show');
                        } else {
                            pendingNotice.classList.remove('show');
                        }
                    } else {
                        pendingNotice.classList.remove('show');
                    }
                }
            );
            
            setTimeout(() => {
                reloadIcon.classList.remove('spinning');
                isRefreshing = false;
                
                const errorMessage = balanceSection.querySelector('.roearn-error-message');
                if (errorMessage) {
                    errorMessage.classList.remove('show');
                    if (errorTimeout) {
                        clearTimeout(errorTimeout);
                    }
                }
            }, 600);
        });
        
        const withdrawButton = balanceSection.querySelector('.roearn-withdraw-button');
        const errorMessage = balanceSection.querySelector('.roearn-error-message');
        let errorTimeout = null;
        
        if (announcementData && announcementData.enabled && announcementData.withdrawalsDisabled) {
            withdrawButton.disabled = true;
            withdrawButton.style.opacity = '0.7';
            withdrawButton.style.cursor = 'not-allowed';
        }
        
        withdrawButton.addEventListener('click', async () => {
            if (announcementData && announcementData.enabled && announcementData.withdrawalsDisabled) {
                return;
            }
            
            if (errorTimeout) {
                clearTimeout(errorTimeout);
            }
            
            if (Number(cachedBalance) < 4) {
                errorMessage.textContent = getMessage("errorMinWithdrawal");
                errorMessage.classList.add('show');
                
                errorTimeout = setTimeout(() => {
                    errorMessage.classList.remove('show');
                }, 10000);
                return;
            }
            
            withdrawButton.disabled = true;
            const originalText = withdrawButton.textContent;
            withdrawButton.textContent = getMessage("loadingText");
            
            try {
                const userData = await getAuthenticatedUser();
                if (!userData) {
                    throw new Error('Failed to get user data');
                }
                
                const withdrawalBalance = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'GET_BALANCE', userId: userData.id },
                        (response) => {
                            if (response && response.success) {
                                resolve(response.balance);
                            } else {
                                resolve(0);
                            }
                        }
                    );
                });
                
                if (withdrawalBalance < 1) {
                    errorMessage.textContent = getMessage("errorMinWithdrawal");
                    errorMessage.classList.add('show');
                    
                    errorTimeout = setTimeout(() => {
                        errorMessage.classList.remove('show');
                    }, 10000);
                    
                    withdrawButton.disabled = false;
                    withdrawButton.textContent = originalText;
                    return;
                }

                errorMessage.classList.remove('show');
                
                window.dispatchEvent(new CustomEvent('roearn:initiateWithdrawal', {
                    detail: {
                        gamepassPrice: withdrawalBalance
                    }
                }));
                
                const handleWithdrawalResult = (event) => {
                    const result = event.detail;
                    
                    if (result.success) {
                        api.storage.local.get(['hasReviewed'], (storageResult) => {
                            if (storageResult.hasReviewed !== true) {
                                api.storage.local.set({ showReviewPrompt: true }, () => {
                                });
                            }
                        });
                        
                        balanceSection.innerHTML = `
                            <div class="roearn-balance-label" style="color: #00a82d; margin-bottom: 20px;">
                                ${getMessage("withdrawalSuccessTitle")}
                            </div>
                            <div class="roearn-success-message" style="font-size: 17px; color: #393b3d; text-align: center; line-height: 1.6; margin-bottom: 30px; max-width: 450px; font-weight: 500;">
                                ${getMessage("withdrawalSuccessMessage")}
                            </div>
                            <button class="roearn-withdraw-button" disabled style="opacity: 0.7; cursor: not-allowed;">
                                ${getMessage("viewTransactionsCountdown", ["45"])}
                            </button>
                        `;
                        
                        let countdown = 45;
                        const transactionButton = balanceSection.querySelector('.roearn-withdraw-button');
                        
                        const countdownInterval = setInterval(() => {
                            countdown--;
                            transactionButton.textContent = getMessage("viewTransactionsCountdown", [countdown.toString()]);
                            
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                transactionButton.textContent = getMessage("viewTransactionsButton");
                                transactionButton.disabled = false;
                                transactionButton.style.opacity = '1';
                                transactionButton.style.cursor = 'pointer';
                                
                                transactionButton.addEventListener('click', () => {
                                    window.location.href = 'https://www.roblox.com/transactions';
                                });
                            }
                        }, 1000);
                        
                    } else {
                        errorMessage.innerHTML = result.error || getMessage("errorDiscordSupport", ["834"]);
                        errorMessage.classList.add('show');
                        
                        withdrawButton.disabled = false;
                        withdrawButton.textContent = originalText;
                    }
                    
                    window.removeEventListener('roearn:withdrawalInitiated', handleWithdrawalResult);
                };
                
                window.addEventListener('roearn:withdrawalInitiated', handleWithdrawalResult);
                
            } catch (error) {
                errorMessage.innerHTML = getMessage("errorDiscordSupport", ["695"]);
                errorMessage.classList.add('show');
                
                withdrawButton.disabled = false;
                withdrawButton.textContent = originalText;
            }
        });
        
        const referralSection = document.createElement('div');
        referralSection.className = 'roearn-referral-section';
        referralSection.style.position = 'relative';

        if (referralUsers >= 1) {
            referralSection.classList.add('roearn-referral-compact');
        }

        const referralReloadIcon = document.createElement('div');
        referralReloadIcon.className = 'roearn-reload-icon';
        referralReloadIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
        `;
        referralSection.appendChild(referralReloadIcon);

        let isRefreshingReferrals = false;

        referralReloadIcon.addEventListener('click', async () => {
            if (isRefreshingReferrals) return;
            
            isRefreshingReferrals = true;
            referralReloadIcon.classList.add('spinning');
            
            const newStats = await new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_STATS', userId: userData.id },
                    (response) => {
                        if (response?.success) {
                            resolve({
                                totalEarnings: response.totalEarnings,
                                totalReferrals: response.totalReferrals
                            });
                        } else {
                            resolve({ totalEarnings: 0, totalReferrals: 0 });
                        }
                    }
                );
            });
            
            const statValues = referralSection.querySelectorAll('.roearn-referral-stat-value');
            if (statValues.length >= 2) {
                statValues[0].innerHTML = `
                    <span class="icon-robux-16x16" style="margin-top: 3px; margin-right: -1px;"></span>${newStats.totalEarnings.toLocaleString()}
                `;
                statValues[1].textContent = newStats.totalReferrals;
            }
            
            if (newStats.totalReferrals >= 1) {
                const referralList = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'GET_REFERRAL_LIST', userId: userData.id },
                        (response) => resolve(response?.success ? response.referrals : [])
                    );
                });
                
                if (referralList.length > 0) {
                    const userIds = referralList.map(r => parseInt(r.userId));
                    const [userDataList, thumbnails] = await Promise.all([
                        fetchUserData(userIds),
                        fetchAvatarThumbnails(userIds)
                    ]);
                    
                    let listContainer = referralSection.querySelector('.roearn-referral-list-container');
                    let listTitle = referralSection.querySelector('.roearn-section-title:last-of-type');
                    
                    if (!listContainer) {
                        const description = referralSection.querySelector('.roearn-referral-description');
                        if (description) {
                            description.remove();
                        }
                        
                        const newListTitle = document.createElement('div');
                        newListTitle.className = 'roearn-section-title';
                        newListTitle.textContent = getMessage("yourReferralsTitle");
                        newListTitle.style.marginTop = '30px';
                        newListTitle.style.marginBottom = '20px';
                        
                        listContainer = document.createElement('div');
                        listContainer.className = 'roearn-referral-list-container';
                        
                        referralSection.appendChild(newListTitle);
                        referralSection.appendChild(listContainer);
                    }
                    
                    listContainer.innerHTML = '';
                    
                    const sortedList = [...referralList].sort((a, b) => {
                        const dateA = new Date(a.joinedAt);
                        const dateB = new Date(b.joinedAt);
                        return dateB - dateA;
                    });
                    
                    const userDataMap = {};
                    userDataList.forEach(user => {
                        userDataMap[user.id] = user;
                    });
                    
                    sortedList.forEach(referral => {
                        const odslajf = parseInt(referral.userId);
                        const user = userDataMap[odslajf];
                        const avatarUrl = thumbnails[odslajf] || 'https://tr.rbxcdn.com/180DAY-a17918617b20ac9c39b305241f23e58a/150/150/AvatarHeadshot/Png';
                        
                        const referralItem = document.createElement('div');
                        referralItem.className = 'roearn-referral-item';
                        
                        const avatar = document.createElement('img');
                        avatar.className = 'roearn-referral-avatar';
                        avatar.src = avatarUrl;
                        avatar.alt = user ? user.name : 'User';
                        avatar.addEventListener('click', () => {
                            window.open(`https://www.roblox.com/users/${odslajf}/profile`, '_blank');
                        });
                        
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'roearn-referral-item-info';
                        
                        const username = document.createElement('div');
                        username.className = 'roearn-referral-item-username';
                        username.textContent = user ? user.displayName : `User ${odslajf}`;
                        username.addEventListener('click', () => {
                            window.open(`https://www.roblox.com/users/${odslajf}/profile`, '_blank');
                        });
                        
                        const displayName = document.createElement('div');
                        displayName.className = 'roearn-referral-item-displayname';
                        displayName.textContent = user ? `@${user.name}` : '@Unknown';
                        
                        infoDiv.appendChild(username);
                        infoDiv.appendChild(displayName);
                        
                        const timestamp = document.createElement('div');
                        timestamp.className = 'roearn-referral-item-timestamp';
                        timestamp.style.display = 'none';
                        const dateOnly = referral.joinedAt.split(' at ')[0];
                        timestamp.textContent = dateOnly;
                        
                        if (referral.bonusGiven === false) {
                            const altTag = document.createElement('div');
                            altTag.className = 'roearn-referral-alt-tag';
                            altTag.textContent = getMessage("altDetectedText");
                            referralItem.appendChild(avatar);
                            referralItem.appendChild(infoDiv);
                            referralItem.appendChild(altTag);
                            referralItem.appendChild(timestamp);
                        } else {
                            referralItem.appendChild(avatar);
                            referralItem.appendChild(infoDiv);
                            referralItem.appendChild(timestamp);
                        }
                        
                        listContainer.appendChild(referralItem);
                    });
                }
            }
            
            setTimeout(() => {
                referralReloadIcon.classList.remove('spinning');
                isRefreshingReferrals = false;
            }, 600);
        });
        
        function createReferralMainView() {
            const container = document.createElement('div');
            
            const referralTitle = document.createElement('div');
            referralTitle.className = 'roearn-section-title';
            referralTitle.textContent = getMessage("referralProgramTitle");
            
            const referralCodeContainer = document.createElement('div');
            referralCodeContainer.className = 'roearn-referral-code-container';
            referralCodeContainer.innerHTML = `
                <div class="roearn-referral-code-label">${getMessage("yourReferralCodeLabel")}</div>
            `;
            
            const codeRow = document.createElement('div');
            codeRow.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
            `;
            
            const codeText = document.createElement('div');
            codeText.className = 'roearn-referral-code';
            codeText.textContent = referralCode;
            
            const copyCodeButton = document.createElement('button');
            copyCodeButton.textContent = getMessage("copyButton");
            copyCodeButton.style.cssText = `
                background: #00a82d;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.2s;
                text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                padding: 8px 20px;
            `;
            
            copyCodeButton.addEventListener('mouseenter', () => {
                copyCodeButton.style.transform = 'translateY(-1px)';
            });
            
            copyCodeButton.addEventListener('mouseleave', () => {
                copyCodeButton.style.transform = 'translateY(0)';
            });
            
            let copyTimeout = null;
            copyCodeButton.addEventListener('click', () => {
                const originalText = getMessage("copyButton");
                
                if (copyTimeout) {
                    clearTimeout(copyTimeout);
                }
                
                api.storage.local.set({ showContentCreatorUI: true });
                
                const leftColumnWrapper = document.querySelector('.roearn-two-column > div:first-child');
                const existingCreatorSection = leftColumnWrapper?.querySelector('.roearn-balance-section[style*="margin-top: 30px"]');
                
                if (leftColumnWrapper && !existingCreatorSection) {
                    const contentCreatorSection = document.createElement('div');
                    contentCreatorSection.className = 'roearn-balance-section';
                    contentCreatorSection.style.marginTop = '30px';
                    contentCreatorSection.style.position = 'relative';
                    contentCreatorSection.style.opacity = '0';
                    contentCreatorSection.style.transform = 'translateY(-10px)';
                    contentCreatorSection.style.transition = 'opacity 0.4s ease-out, transform 0.4s ease-out';
                    
                    contentCreatorSection.innerHTML = `
                        <div class="roearn-section-title" style="margin-bottom: 10px;">${getMessage("contentCreatorTitle")}</div><br>
                        
                        <div style="padding: 0px 15px 15px 15px;">
                            <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                                <span>${getMessage("contentCreatorPayout").split('100 Robux')[0]}</span>
                                <span class="icon-robux-16x16"></span>
                                <span>100 ${getMessage("contentCreatorPayout").split('100 ')[1]}</span>
                            </div>
                            
                            <div style="text-align: center; color: #606162; font-size: 13px; line-height: 1.6; margin-bottom: 12px;">${getMessage("contentCreatorDescription")}</div>
                            
                            <div style="text-align: center; color: #606162; font-size: 15px; line-height: 1.6;">
                                ${getMessage("contentCreatorContact").split('creators@roearn.io')[0]}<a href="mailto:creators@roearn.io" style="color: rgba(43, 124, 218, 1); font-weight: 500; text-decoration: none;">creators@roearn.io</a>${getMessage("contentCreatorContact").split('creators@roearn.io')[1]}
                                <br>
                            </div>
                            <br>
                            <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                                <span>${getMessage("contentCreatorLink").split('"roearn.io"')[0]}</span>
                                <u style="text-underline-offset: 3px;">"roearn.io"</u>
                                <span>${getMessage("contentCreatorLink").split('"roearn.io"')[1]}</span>
                            </div>
                        </div>
                    `;
                    
                    leftColumnWrapper.appendChild(contentCreatorSection);
                    
                    setTimeout(() => {
                        contentCreatorSection.style.opacity = '1';
                        contentCreatorSection.style.transform = 'translateY(0)';
                    }, 10);
                }
                
                navigator.clipboard.writeText(referralCode).then(() => {
                    copyCodeButton.textContent = getMessage("copiedButton");
                    copyTimeout = setTimeout(() => {
                        copyCodeButton.textContent = originalText;
                    }, 2000);
                });
            });

            codeRow.appendChild(codeText);
            codeRow.appendChild(copyCodeButton);
            referralCodeContainer.appendChild(codeRow);

            const copyLinkButton = document.createElement('button');
            copyLinkButton.textContent = getMessage("copyExtensionLink");
            copyLinkButton.style.cssText = `
                background: #6c757d;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                padding: 8px 20px;
                margin-top: 15px;
                display: block;
                margin-left: auto;
                margin-right: auto;
            `;

            copyLinkButton.addEventListener('mouseenter', () => {
                copyLinkButton.style.transform = 'translateY(-1px)';
                copyLinkButton.style.background = '#5a6268';
            });

            copyLinkButton.addEventListener('mouseleave', () => {
                copyLinkButton.style.transform = 'translateY(0)';
                copyLinkButton.style.background = '#6c757d';
            });

            let copyLinkTimeout = null;
            copyLinkButton.addEventListener('click', () => {
                const originalText = getMessage("copyExtensionLink");
                
                if (copyLinkTimeout) {
                    clearTimeout(copyLinkTimeout);
                }
                
                navigator.clipboard.writeText('https://chromewebstore.google.com/detail/roearn-cashback-on-roblox/fooenmopnfaejehogdbmegaleanpdcea').then(() => {
                    copyLinkButton.textContent = getMessage("copiedButton");
                    copyLinkTimeout = setTimeout(() => {
                        copyLinkButton.textContent = originalText;
                    }, 2000);
                });
            });

            referralCodeContainer.appendChild(copyLinkButton);
            
            const referralStats = document.createElement('div');
            referralStats.className = 'roearn-referral-stats';
            referralStats.innerHTML = `
                <div class="roearn-referral-stat">
                    <div class="roearn-referral-stat-value">
                        <span class="icon-robux-16x16" style="margin-top: 3px; margin-right: -1px;"></span>${referralEarnings.toLocaleString()}
                    </div>
                    <div class="roearn-referral-stat-label">${getMessage("totalEarnedLabel")}</div>
                </div>
                <div class="roearn-referral-stat">
                    <div class="roearn-referral-stat-value">${referralUsers}</div>
                    <div class="roearn-referral-stat-label">${getMessage("referralsLabel")}</div>
                </div>
            `;
            
            container.appendChild(referralTitle);
            container.appendChild(referralCodeContainer);
            container.appendChild(referralStats);
            
            if (referralUsers === 0) {
                const referralDescription = document.createElement('div');
                referralDescription.className = 'roearn-referral-description';
                referralDescription.innerHTML = getMessage("referralDescription");
                container.appendChild(referralDescription);
            }
            
            return container;
        }
        
        const mainView = createReferralMainView();
        referralSection.appendChild(mainView);
        
        if (referralUsers >= 1 && prefetchedReferralData) {
            const listTitle = document.createElement('div');
            listTitle.className = 'roearn-section-title';
            listTitle.textContent = getMessage("yourReferralsTitle");
            listTitle.style.marginTop = '30px';
            listTitle.style.marginBottom = '20px';
            
            const listContainer = document.createElement('div');
            listContainer.className = 'roearn-referral-list-container';
            
            const sortedList = [...prefetchedReferralData.referralList].sort((a, b) => {
                const dateA = new Date(a.joinedAt);
                const dateB = new Date(b.joinedAt);
                return dateB - dateA;
            });
            
            const userDataMap = {};
            prefetchedReferralData.userDataList.forEach(user => {
                userDataMap[user.id] = user;
            });
            
            sortedList.forEach(referral => {
                const userId = parseInt(referral.userId);
                const user = userDataMap[userId];
                const avatarUrl = prefetchedReferralData.thumbnails[userId] || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
                
                const referralItem = document.createElement('div');
                referralItem.className = 'roearn-referral-item';
                
                const avatar = document.createElement('img');
                avatar.className = 'roearn-referral-avatar';
                avatar.src = avatarUrl;
                avatar.alt = user ? user.name : 'User';
                avatar.addEventListener('click', () => {
                    window.open(`https://www.roblox.com/users/${userId}/profile`, '_blank');
                });
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'roearn-referral-item-info';
                
                const username = document.createElement('div');
                username.className = 'roearn-referral-item-username';
                username.textContent = user ? user.displayName : `User ${userId}`;
                username.addEventListener('click', () => {
                    window.open(`https://www.roblox.com/users/${userId}/profile`, '_blank');
                });
                
                const displayName = document.createElement('div');
                displayName.className = 'roearn-referral-item-displayname';
                displayName.textContent = user ? `@${user.name}` : '@Unknown';
                
                infoDiv.appendChild(username);
                infoDiv.appendChild(displayName);
                
                const timestamp = document.createElement('div');
                timestamp.className = 'roearn-referral-item-timestamp';
                timestamp.style.display = 'none';
                const dateOnly = referral.joinedAt.split(' at ')[0];
                timestamp.textContent = dateOnly;
                
                if (referral.bonusGiven === false) {
                    const altTag = document.createElement('div');
                    altTag.className = 'roearn-referral-alt-tag';
                    altTag.textContent = getMessage("altDetectedText");
                    referralItem.appendChild(avatar);
                    referralItem.appendChild(infoDiv);
                    referralItem.appendChild(altTag);
                    referralItem.appendChild(timestamp);
                } else {
                    referralItem.appendChild(avatar);
                    referralItem.appendChild(infoDiv);
                    referralItem.appendChild(timestamp);
                }
                
                listContainer.appendChild(referralItem);
            });
            
            referralSection.appendChild(listTitle);
            referralSection.appendChild(listContainer);
        }
        
        const leftColumnWrapper = document.createElement('div');
        leftColumnWrapper.appendChild(balanceSection);

        if (showContentCreatorUI) {
            const contentCreatorSection = document.createElement('div');
            contentCreatorSection.className = 'roearn-balance-section';
            contentCreatorSection.style.marginTop = '30px';
            contentCreatorSection.style.position = 'relative';
            
            contentCreatorSection.innerHTML = `
                <div class="roearn-section-title" style="margin-bottom: 10px;">${getMessage("contentCreatorTitle")}</div><br>
                
                <div style="padding: 0px 15px 15px 15px;">
                    <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                        <span>${getMessage("contentCreatorPayout").split('100 Robux')[0]}</span>
                        <span class="icon-robux-16x16"></span>
                        <span>100 ${getMessage("contentCreatorPayout").split('100 ')[1]}</span>
                    </div>
                    
                    <div style="text-align: center; color: #606162; font-size: 13px; line-height: 1.6; margin-bottom: 12px;">${getMessage("contentCreatorDescription")}</div>
                    
                    <div style="text-align: center; color: #606162; font-size: 15px; line-height: 1.6;">
                        ${getMessage("contentCreatorContact").split('creators@roearn.io')[0]}<a href="mailto:creators@roearn.io" style="color: rgba(59, 135, 221, 1); font-weight: 500; text-decoration: none;">creators@roearn.io</a>${getMessage("contentCreatorContact").split('creators@roearn.io')[1]}
                        <br>
                    </div>
                    <br>
                    <div style="text-align: center; color: #393b3d; font-size: 15px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: center; gap: 4px; flex-wrap: wrap;">
                        <span>${getMessage("contentCreatorLink").split('"roearn.io"')[0]}</span>
                        <u style="text-underline-offset: 3px;">"roearn.io"</u>
                        <span>${getMessage("contentCreatorLink").split('"roearn.io"')[1]}</span>
                    </div>
                </div>
            `;
                        
            leftColumnWrapper.appendChild(contentCreatorSection);
        }

        twoColumn.appendChild(leftColumnWrapper);
        twoColumn.appendChild(referralSection);

        panel.appendChild(header);

        const announcementBanner = createAnnouncementBanner();
        if (announcementBanner) {
            panel.appendChild(announcementBanner);
        }
        
        panel.appendChild(twoColumn);
        
        return panel;
    }
    
    function waitForContent() {
        return new Promise((resolve) => {
            const content = document.getElementById('content');
            if (content) {
                resolve(content);
                return;
            }
            
            const observer = new MutationObserver(() => {
                const content = document.getElementById('content');
                if (content) {
                    observer.disconnect();
                    resolve(content);
                }
            });
            
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }
    
    async function init() {
        await localizationReady;
        
        await fetchAnnouncementBanner();
                
        const content = await waitForContent();
        
        const pageBackground = document.createElement('div');
        pageBackground.className = 'roearn-page-background';
        
        const coinPositions = [
            { left: '2%', top: '5%', scale: '2', delay: '0s', gradient: 'gradient-1' },
            { left: '8%', top: '20%', scale: '2', delay: '0s', gradient: 'gradient-1' },
            { left: '18%', top: '65%', scale: '1.75', delay: '1s', gradient: 'gradient-2' },
            { left: '28%', top: '35%', scale: '1.6', delay: '2s', gradient: 'gradient-3' },
            { left: '38%', top: '75%', scale: '1.85', delay: '0.5s', gradient: 'gradient-4' },
            { left: '48%', top: '15%', scale: '1.7', delay: '1.5s', gradient: 'gradient-1' },
            { left: '58%', top: '80%', scale: '1.95', delay: '2.5s', gradient: 'gradient-2' },
            { left: '68%', top: '25%', scale: '1.8', delay: '3s', gradient: 'gradient-3' },
            { left: '78%', top: '60%', scale: '1.65', delay: '1.8s', gradient: 'gradient-4' },
            { left: '88%', top: '40%', scale: '1.9', delay: '2.2s', gradient: 'gradient-1' },
            { left: '15%', top: '50%', scale: '1.75', delay: '0.8s', gradient: 'gradient-2' },
            { left: '72%', top: '85%', scale: '1.6', delay: '3.5s', gradient: 'gradient-3' },
            { left: '92%', top: '75%', scale: '1.85', delay: '1.2s', gradient: 'gradient-4' },
            { left: '5%', top: '80%', scale: '1.7', delay: '2.8s', gradient: 'gradient-1' },
            { left: '50%', top: '50%', scale: '1.75', delay: '0.3s', gradient: 'gradient-2' },
            { left: '85%', top: '18%', scale: '1.6', delay: '3.2s', gradient: 'gradient-3' },
            { left: '12%', top: '30%', scale: '1.8', delay: '1.6s', gradient: 'gradient-4' },
            { left: '32%', top: '55%', scale: '1.7', delay: '2.3s', gradient: 'gradient-1' },
            { left: '42%', top: '10%', scale: '1.65', delay: '0.7s', gradient: 'gradient-2' },
            { left: '62%', top: '45%', scale: '1.9', delay: '3.1s', gradient: 'gradient-3' },
            { left: '82%', top: '70%', scale: '1.75', delay: '1.4s', gradient: 'gradient-4' },
            { left: '22%', top: '85%', scale: '1.8', delay: '2.6s', gradient: 'gradient-1' },
            { left: '52%', top: '30%', scale: '1.7', delay: '0.9s', gradient: 'gradient-2' },
            { left: '95%', top: '55%', scale: '1.85', delay: '2.1s', gradient: 'gradient-3' },
            { left: '3%', top: '40%', scale: '1.65', delay: '3.3s', gradient: 'gradient-4' },
            { left: '45%', top: '90%', scale: '1.75', delay: '1.1s', gradient: 'gradient-1' },
            { left: '65%', top: '12%', scale: '1.9', delay: '2.9s', gradient: 'gradient-2' },
            { left: '75%', top: '48%', scale: '1.7', delay: '0.4s', gradient: 'gradient-3' },
            { left: '35%', top: '22%', scale: '1.8', delay: '3.4s', gradient: 'gradient-4' },
            { left: '55%', top: '65%', scale: '1.65', delay: '1.7s', gradient: 'gradient-1' },
            { left: '90%', top: '28%', scale: '1.75', delay: '2.4s', gradient: 'gradient-2' },
            { left: '10%', top: '10%', scale: '1.8', delay: '1.3s', gradient: 'gradient-3' },
            { left: '25%', top: '70%', scale: '1.7', delay: '2.7s', gradient: 'gradient-4' },
            { left: '40%', top: '5%', scale: '1.9', delay: '0.6s', gradient: 'gradient-1' },
            { left: '60%', top: '95%', scale: '1.85', delay: '3.6s', gradient: 'gradient-2' },
            { left: '70%', top: '38%', scale: '1.75', delay: '1.9s', gradient: 'gradient-3' },
            { left: '80%', top: '8%', scale: '1.6', delay: '2.5s', gradient: 'gradient-4' },
            { left: '98%', top: '45%', scale: '1.7', delay: '0.2s', gradient: 'gradient-1' },
            { left: '7%', top: '58%', scale: '1.8', delay: '3.7s', gradient: 'gradient-2' },
            { left: '20%', top: '15%', scale: '1.65', delay: '1.5s', gradient: 'gradient-3' },
            { left: '33%', top: '88%', scale: '1.9', delay: '2.8s', gradient: 'gradient-4' },
            { left: '47%', top: '42%', scale: '1.75', delay: '0.9s', gradient: 'gradient-1' },
            { left: '63%', top: '68%', scale: '1.7', delay: '3.2s', gradient: 'gradient-2' },
            { left: '77%', top: '92%', scale: '1.85', delay: '1.7s', gradient: 'gradient-3' },
            { left: '87%', top: '52%', scale: '1.8', delay: '2.3s', gradient: 'gradient-4' },
            { left: '93%', top: '12%', scale: '1.6', delay: '0.8s', gradient: 'gradient-1' },
            { left: '4%', top: '72%', scale: '1.75', delay: '3.4s', gradient: 'gradient-2' },
            { left: '14%', top: '25%', scale: '1.9', delay: '1.4s', gradient: 'gradient-3' },
            { left: '27%', top: '48%', scale: '1.7', delay: '2.9s', gradient: 'gradient-4' },
            { left: '37%', top: '62%', scale: '1.65', delay: '0.5s', gradient: 'gradient-1' },
            { left: '53%', top: '78%', scale: '1.85', delay: '3.5s', gradient: 'gradient-2' },
            { left: '67%', top: '6%', scale: '1.8', delay: '1.8s', gradient: 'gradient-3' },
            { left: '73%', top: '35%', scale: '1.75', delay: '2.6s', gradient: 'gradient-4' },
            { left: '83%', top: '82%', scale: '1.7', delay: '0.4s', gradient: 'gradient-1' },
            { left: '96%', top: '65%', scale: '1.6', delay: '3.3s', gradient: 'gradient-2' },
            { left: '9%', top: '45%', scale: '1.9', delay: '1.6s', gradient: 'gradient-3' },
            { left: '24%', top: '92%', scale: '1.75', delay: '2.7s', gradient: 'gradient-4' },
            { left: '44%', top: '28%', scale: '1.85', delay: '0.7s', gradient: 'gradient-1' },
            { left: '56%', top: '58%', scale: '1.7', delay: '3.6s', gradient: 'gradient-2' },
            { left: '71%', top: '72%', scale: '1.65', delay: '1.2s', gradient: 'gradient-3' }
        ];
        
        coinPositions.forEach((pos, index) => {
            const coin = document.createElement('span');
            coin.className = `icon-robux-16x16 roearn-floating-coin ${pos.gradient}`;
            coin.style.left = pos.left;
            coin.style.top = pos.top;
            coin.style.setProperty('--coin-scale', pos.scale);
            coin.style.setProperty('--entrance-delay', `${index * 0.03}s`);
            coin.style.animationDelay = pos.delay;
            pageBackground.appendChild(coin);
        });
        
        document.body.appendChild(pageBackground);
        
        const tutorialCompleted = await new Promise((resolve) => {
            api.storage.local.get(['tutorialCompleted'], (result) => {
                resolve(result.tutorialCompleted === true);
            });
        });
        
        if (!tutorialCompleted) {
            content.innerHTML = '';
            content.classList.add('roearn-panel-ready');
            const panel = await createRoEarnPanel();
            content.appendChild(panel);
        } else {
            content.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 400px;"><span class="spinner spinner-default"></span></div>';
            content.classList.add('roearn-panel-ready');
            
            globalPrefetchedData = await prefetchAllData();
            const panel = await createRoEarnPanel();
            content.innerHTML = '';
            content.appendChild(panel);
        }
    }
        
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    
})();