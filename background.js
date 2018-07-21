(function(){
	var _port
	var _updateTimeout = null
	var _cacheThrottling = 100

	const updateTabCache = function() {
		_updateTimeout = null;
		var tabsCache = [];
		chrome.windows.getAll({windowTypes:["normal"]}, function(windows) {
			let windowTabsRemaining = windows.length;
			windows.forEach(function(win, wi) {
				chrome.tabs.query({windowId:win.id}, function(tabs) {
					tabsCache = tabsCache.concat(tabs)
					windowTabsRemaining--;
					if (windowTabsRemaining == 0) {
						setTabCache(tabsCache)
					}
				});
			});	
		})
	}

	const setTabCache = function(tabCache) {
		chrome.storage.local.set({tabs: tabCache}, function() {});
	}

	const throttledUpdateTabCache = function() {
		clearTimeout(_updateTimeout);
		_updateTimeout = setTimeout(updateTabCache, _cacheThrottling);
	}

	chrome.tabs.onUpdated.addListener(throttledUpdateTabCache)
	chrome.tabs.onDetached.addListener(throttledUpdateTabCache)
	chrome.tabs.onRemoved.addListener(throttledUpdateTabCache)
	chrome.tabs.onAttached.addListener(throttledUpdateTabCache)
	chrome.tabs.onMoved.addListener(throttledUpdateTabCache)
	chrome.tabs.onCreated.addListener(throttledUpdateTabCache)
	chrome.windows.onFocusChanged.addListener(throttledUpdateTabCache)

	updateTabCache()
})()