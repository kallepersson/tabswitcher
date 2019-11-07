(function(){
	var _updateTimeout = null;
	var _cacheThrottling = 100;
	var _showTabsFromAllWindows = true;

	const updateIcon = function() {
		var isDarkMode = matchMedia('(prefers-color-scheme: dark)').matches;
		var iconPathSuffix = isDarkMode ? "-inv" : "";
		chrome.browserAction.setIcon({
			path:{
				"16":"icons/icon-16"+iconPathSuffix+".png",
				"19":"icons/icon-19"+iconPathSuffix+".png",
				"38":"icons/icon-38"+iconPathSuffix+".png",
				"48":"icons/icon-48"+iconPathSuffix+".png",
				"128":"icons/icon-128"+iconPathSuffix+".png",
				"256":"icons/icon-256"+iconPathSuffix+".png"
			}
		})
	}

	const updateTabCache = function() {
		_updateTimeout = null;
		var tabsCache = [];
		if (_showTabsFromAllWindows) {
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
		} else {
			chrome.tabs.query({currentWindow:true}, function(tabs) {
				setTabCache(tabs);
			});
		}
	}

	const setTabCache = function(tabCache) {
		chrome.storage.local.set({tabs: tabCache}, function() {});
	}

	const throttledUpdateTabCache = function() {
		clearTimeout(_updateTimeout);
		_updateTimeout = setTimeout(updateTabCache, _cacheThrottling);
	}

	const onStorageChanged = function(changes, areaName) {
		if (areaName != "sync") {
			return;
		}

		loadConfiguration(updateTabCache);
	}

	const loadConfiguration = function(callback) {
		chrome.storage.sync.get({showTabsFromAllWindows:true}, (items) => {
			_showTabsFromAllWindows = items.showTabsFromAllWindows;
			if (callback) {
				callback();
			}
		});
	}

	chrome.tabs.onUpdated.addListener(throttledUpdateTabCache)
	chrome.tabs.onDetached.addListener(throttledUpdateTabCache)
	chrome.tabs.onRemoved.addListener(throttledUpdateTabCache)
	chrome.tabs.onAttached.addListener(throttledUpdateTabCache)
	chrome.tabs.onMoved.addListener(throttledUpdateTabCache)
	chrome.tabs.onCreated.addListener(throttledUpdateTabCache)
	chrome.windows.onFocusChanged.addListener(throttledUpdateTabCache)

	chrome.storage.onChanged.addListener(onStorageChanged)

	chrome.runtime.onMessage.addListener(function(message, callback) {
		if (message.data == "forceReload") {
			updateTabCache()
		}
	})

	loadConfiguration(updateTabCache)
	updateIcon()
})()