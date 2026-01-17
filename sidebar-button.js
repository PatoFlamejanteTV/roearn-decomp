(function() {
    function injectHideCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'roearn-nav-style';
            style.textContent = `
                #navigation .left-col-list {
                    visibility: hidden !important;
                }
                #navigation .left-col-list.roearn-ready {
                    visibility: visible !important;
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
    
    function createRoEarnButton() {
        if (document.getElementById('nav-roearn')) {
            return;
        }

        const navList = document.querySelector('#navigation .left-col-list');
        if (!navList) {
            return;
        }

        const rbxBody = document.getElementById('rbx-body');
        const isDarkTheme = rbxBody && rbxBody.classList.contains('dark-theme');

        const roEarnLi = document.createElement('li');
        
        const roEarnLink = document.createElement('a');
        roEarnLink.className = 'dynamic-overflow-container text-nav';
        roEarnLink.href = '/roearn';
        roEarnLink.id = 'nav-roearn';
        roEarnLink.target = '_self';
        
        const iconDiv = document.createElement('div');
        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/sidebar-icon.png');
        iconImg.style.width = '28px';
        iconImg.style.height = '28px';
        iconImg.style.transition = 'filter 0.2s ease';
        iconImg.style.userSelect = 'none';
        iconImg.style.webkitUserSelect = 'none';
        iconImg.style.mozUserSelect = 'none';
        iconImg.style.msUserSelect = 'none';
        iconImg.style.pointerEvents = 'none';
        iconImg.draggable = false;
        
        let defaultFilter, hoverFilter;
        
        if (isDarkTheme) {
            defaultFilter = 'brightness(0) saturate(100%) invert(76%) sepia(0%) saturate(262%) hue-rotate(155deg) brightness(92%) contrast(87%)';
            hoverFilter = 'brightness(0) invert(1)'; 
        } else {
            defaultFilter = 'brightness(0) saturate(100%) invert(50%) sepia(6%) saturate(378%) hue-rotate(155deg) brightness(93%) contrast(88%)';
            hoverFilter = 'brightness(0) saturate(100%) invert(22%) sepia(4%) saturate(686%) hue-rotate(155deg) brightness(95%) contrast(90%)';
        }
        
        iconImg.style.filter = defaultFilter;
        
        iconDiv.appendChild(iconImg);
        
        const textSpan = document.createElement('span');
        textSpan.className = 'font-header-2 dynamic-ellipsis-item';
        textSpan.title = 'RoEarn';
        textSpan.textContent = 'RoEarn';
        
        roEarnLink.addEventListener('mouseenter', function() {
            iconImg.style.filter = hoverFilter;
        });
        
        roEarnLink.addEventListener('mouseleave', function() {
            iconImg.style.filter = defaultFilter;
        });
        
        roEarnLink.appendChild(iconDiv);
        roEarnLink.appendChild(textSpan);
        
        roEarnLi.appendChild(roEarnLink);
        
        navList.insertBefore(roEarnLi, navList.firstChild);
        
        navList.classList.add('roearn-ready');
                
        if (observer) {
            observer.disconnect();
        }
    }

    const observer = new MutationObserver((mutations) => {
        createRoEarnButton();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createRoEarnButton);
    } else {
        createRoEarnButton();
    }
})();