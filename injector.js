(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const urlElement = document.createElement('div');
    urlElement.id = '__roearn_extension_url__';
    urlElement.style.display = 'none';
    urlElement.dataset.url = api.runtime.getURL('');
    (document.head || document.documentElement).appendChild(urlElement);

    const result = await api.storage.local.get(['userLocale']);
    const locale = result.userLocale || 'en';
    
    const localeElement = document.createElement('div');
    localeElement.id = '__roearn_user_locale__';
    localeElement.style.display = 'none';
    localeElement.dataset.locale = locale;
    (document.head || document.documentElement).appendChild(localeElement);

    const checkoutScript = document.createElement('script');
    checkoutScript.src = api.runtime.getURL('checkout.js');
    checkoutScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(checkoutScript);
    
    const checkoutBulkScript = document.createElement('script');
    checkoutBulkScript.src = api.runtime.getURL('checkout-bulk.js');
    checkoutBulkScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(checkoutBulkScript);
    
    const withdrawalScript = document.createElement('script');
    withdrawalScript.src = api.runtime.getURL('initiate-withdrawal.js');
    withdrawalScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(withdrawalScript);
})();

window.addEventListener('roearn:launchGame', function(event) {
    const { assetId, assetType, userId } = event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    api.runtime.sendMessage({
        type: 'LAUNCH_GAME',
        assetId: assetId,
        assetType: assetType,
        userId: userId
    });
});

window.addEventListener('roearn:launchGameBulk', function(event) {
    const { items, userId } = event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    api.runtime.sendMessage({
        type: 'LAUNCH_GAME_BULK',
        items: items,
        userId: userId
    });
});

window.addEventListener('roearn:submitWithdrawalToAPI', function(event) {
    const { userId, gamepassId } = event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    api.runtime.sendMessage(
        {
            type: 'SUBMIT_WITHDRAWAL',
            userId: userId,
            gamepassId: gamepassId
        },
        (response) => {
            window.dispatchEvent(new CustomEvent('roearn:withdrawalAPIResponse', {
                detail: response
            }));
        }
    );
});