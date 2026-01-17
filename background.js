const api = typeof browser !== 'undefined' ? browser : chrome;

const launchGameInstance = (placeId, instanceId) => 
    window.Roblox.GameLauncher.joinGameInstance(placeId, instanceId);

const ROBLOX_TO_CHROME_LOCALE = {
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

async function fetchAndStoreLocale() {
    try {
        const response = await fetch('https://locale.roblox.com/v1/locales/user-localization-locus-supported-locales', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const robloxLocale = data?.generalExperience?.locale || 'en_us';
            const locale = ROBLOX_TO_CHROME_LOCALE[robloxLocale] || 'en';
            
            await api.storage.local.set({ userLocale: locale });
        }
    } catch (e) {
    }
}

fetchAndStoreLocale();

api.alarms.create('fetchLocale', { periodInMinutes: 0.5 });

api.runtime.onUpdateAvailable.addListener(() => {
    api.runtime.reload();
});

api.runtime.onStartup.addListener(() => {
    api.runtime.requestUpdateCheck((status) => {
        if (status === 'update_available') {
            api.runtime.reload();
        }
    });
});


api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fetchLocale') {
        fetchAndStoreLocale();
    }
});

api.runtime.onInstalled.addListener(async (details) => {
    await fetchAndStoreLocale();
    if (details.reason === 'install') {
        api.tabs.create({ url: 'https://www.roblox.com/roearn' });
    }
});

api.action.onClicked.addListener(() => {
    api.tabs.create({ url: 'https://www.roblox.com/roearn' });
});

async function getManualReviewalStatus(userId) {
    try {
        const response = await fetch('https://roearn-api.com/manual_reviewal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return { pending: false, count: 0, items: [] };
        }
        
        const data = await response.json();
        
        if (Object.keys(data).length === 0) {
            return { pending: false, count: 0, items: [] };
        }
        
        if (data.status === 'under_review' && data.items) {
            return { pending: true, count: data.items.length, items: data.items };
        }
        
        return { pending: false, count: 0, items: [] };
    } catch (error) {
        return { pending: false, count: 0, items: [] };
    }
}

async function getRoEarnBalance(userId) {
    try {
        const response = await fetch('https://roearn-api.com/user_balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return 0;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && typeof data.balance === 'number') {
            const robuxBalance = data.balance
            return robuxBalance;
        }
        
        return 0;
    } catch (error) {
        return 0;
    }
}

async function submitWithdrawal(userId, gamepassId) {
    try {
        const response = await fetch('https://roearn-api.com/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString(),
                gamepassId: gamepassId.toString()
            })
        });
        
        if (!response.ok) {
            return { success: false, error: 'Failed to submit withdrawal to API' };
        }
        
        const data = await response.json();
        return { success: true, data: data };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setReferral(userId, referralCode, gamepassId) {
    try {
        const response = await fetch('https://roearn-api.com/set_referral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString(),
                referralCode: referralCode,
                gamepassId: gamepassId.toString()
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, error: errorData.error || 'Failed to set referral' };
        }
        
        const data = await response.json();
        return { success: true, data: data };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function checkHasReferral(userId) {
    try {
        const response = await fetch('https://roearn-api.com/has_referral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return data.hasReferral;
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

async function getReferralStats(userId) {
    try {
        const response = await fetch('https://roearn-api.com/referral_stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return { totalEarnings: 0, totalReferrals: 0 };
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return {
                totalEarnings: data.totalEarnings,
                totalReferrals: data.totalReferrals
            };
        }
        
        return { totalEarnings: 0, totalReferrals: 0 };
    } catch (error) {
        return { totalEarnings: 0, totalReferrals: 0 };
    }
}

async function getAnnouncementBanner() {
    try {
        const response = await fetch('https://roearn-api.com/get-message-header', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return { enabled: false };
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        return { enabled: false };
    }
}

async function getReferralList(userId) {
    try {
        const response = await fetch('https://roearn-api.com/referral_list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return data.referrals;
        }
        
        return [];
    } catch (error) {
        return [];
    }
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'LAUNCH_GAME') {
        (async () => {
            const { assetId, assetType, userId } = request;
            
            const placeRes = await fetch("https://roearn-api.com/placeid");
            const placeData = await placeRes.json();
            const placeId = placeData.placeId;
            
            await fetch("https://roearn-api.com/item_request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assetType, assetId, userId: String(userId) })
            });

            api.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: launchGameInstance,
                args: [parseInt(placeId), ""],
                world: 'MAIN',
            });
        })();
        return true;
    }

    if (request.type === 'LAUNCH_GAME_BULK') {
        (async () => {
            const { items, userId } = request;
            
            const placeRes = await fetch("https://roearn-api.com/placeid");
            const placeData = await placeRes.json();
            const placeId = placeData.placeId;
            
            const formattedItems = items.map(item => ({
                assetType: item.assetType,
                assetId: String(item.assetId)
            }));
            
            await fetch("https://roearn-api.com/bulk_item_request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    userId: String(userId),
                    items: formattedItems
                })
            });

            api.scripting.executeScript({
                target: { tabId: sender.tab.id },
                func: launchGameInstance,
                args: [parseInt(placeId), ""],
                world: 'MAIN',
            });
        })();
        return true;
    }

    if (request.type === 'GET_ANNOUNCEMENT') {
        (async () => {
            try {
                const data = await getAnnouncementBanner();
                sendResponse({ success: true, ...data });
            } catch (error) {
                sendResponse({ success: false, enabled: false, error: error.message });
            }
        })();
        
        return true;
    }
    
    if (request.type === 'GET_REFERRAL_LIST') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, referrals: [], error: 'User ID not provided' });
                    return;
                }
                
                const referrals = await getReferralList(userId);
                
                sendResponse({ success: true, referrals: referrals });
            } catch (error) {
                sendResponse({ success: false, referrals: [], error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'GET_REFERRAL_STATS') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, totalEarnings: 0, totalReferrals: 0, error: 'User ID not provided' });
                    return;
                }
                
                const stats = await getReferralStats(userId);
                
                sendResponse({ success: true, ...stats });
            } catch (error) {
                sendResponse({ success: false, totalEarnings: 0, totalReferrals: 0, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'GET_MANUAL_REVIEWAL') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, pending: false, count: 0 });
                    return;
                }
                
                const status = await getManualReviewalStatus(userId);
                sendResponse({ success: true, ...status });
            } catch (error) {
                sendResponse({ success: false, pending: false, count: 0 });
            }
        })();
        
        return true;
    }

    if (request.type === 'HAS_REFERRAL') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, hasReferral: false, error: 'User ID not provided' });
                    return;
                }
                
                const hasReferral = await checkHasReferral(userId);
                
                sendResponse({ success: true, hasReferral: hasReferral });
            } catch (error) {
                sendResponse({ success: false, hasReferral: false, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'SET_REFERRAL') {
        (async () => {
            try {
                const userId = request.userId;
                const referralCode = request.referralCode;
                const gamepassId = request.gamepassId;
                
                if (!userId || !referralCode) {
                    sendResponse({ success: false, error: 'User ID or Referral Code not provided' });
                    return;
                }
                
                if (!gamepassId) {
                    sendResponse({ success: false, error: 'Gamepass ID not provided for verification' });
                    return;
                }
                
                const result = await setReferral(userId, referralCode, gamepassId);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'CHECK_UPDATE') {
        api.runtime.requestUpdateCheck((status) => {
            if (status === 'update_available') {
                api.runtime.reload();
            }
        });
        return true;
    }
    
    if (request.type === 'GET_BALANCE') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, balance: 0, error: 'User ID not provided' });
                    return;
                }
                
                const balance = await getRoEarnBalance(userId);
                
                sendResponse({ success: true, balance: balance });
            } catch (error) {
                sendResponse({ success: false, balance: 0, error: error.message });
            }
        })();
        
        return true;
    }
    
    if (request.type === 'SUBMIT_WITHDRAWAL') {
        (async () => {
            try {
                const userId = request.userId;
                const gamepassId = request.gamepassId;
                
                if (!userId || !gamepassId) {
                    sendResponse({ success: false, error: 'User ID or Gamepass ID not provided' });
                    return;
                }
                
                const result = await submitWithdrawal(userId, gamepassId);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true;
    }
    
    const messageData = request.message;
    
    if (messageData) {
        const { place, id, assetType, assetId, userId } = messageData;
        
        (async () => {
            try {
                const url = "https://roearn-api.com/item_request";
                                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        assetType,
                        assetId,
                        userId: String(userId),
                    })
                });

                const data = await response.json();

                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [place, id],
                    world: 'MAIN',
                });
                
            } catch (error) {
                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [place, id],
                    world: 'MAIN',
                });
            }
        })();
    }
    
    return true;
});