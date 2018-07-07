(function(){
	var _tabsCache = []
	var _port
	var _updateTimeout = null
	var _cacheThrottling = 300

	const onMessage = function(message) {
		if (message.command == "request-tabs") {
			sendTabs()
		}
	}

	const sendTabs = function() {
		var popups = chrome.extension.getViews({type: "popup"})
		if (!popups || popups.length == 0) {
			return
		}

		popups[0].setTabs(_tabsCache)
	}

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
						_tabsCache = tabsCache;
					}
				});
			});	
		})
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


	chrome.extension.onConnect.addListener(function(port) {
		_port = port
		_port.onMessage.addListener(onMessage)
	})

	updateTabCache()
})()