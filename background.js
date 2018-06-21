(function(){
	var _tabsCache = []
	var _tabsActivatedTimestamps = {}
	var _port

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

		popups[0].setTabs(_tabsCache, _tabsActivatedTimestamps)
	}

	const queryAllTabs = function(resolve, reject) {
		_tabsCache = [];
		chrome.windows.getAll({windowTypes:["normal"]}, function(windows) {
			windows.forEach(function(win) {
				chrome.tabs.query({windowId:win.id}, function(tabs) {
					_tabsCache = _tabsCache.concat(tabs)
				});
			});	
		})
		_updateCount++
		console.log(_updateCount)
	}

	const updateTabCache = function() {
		_tabsCache = [];
		chrome.windows.getAll({windowTypes:["normal"]}, function(windows) {
			windows.forEach(function(win) {
				chrome.tabs.query({windowId:win.id}, function(tabs) {
					_tabsCache = _tabsCache.concat(tabs)
				});
			});	
		})
	}

	const updateTabLastActivated = function(tab) {
		if (!tab || !tab.tabId) {
			return;
		}
		_tabsActivatedTimestamps[tab.tabId] = Date.now();
	}

	chrome.tabs.onUpdated.addListener(updateTabCache)
	chrome.tabs.onDetached.addListener(updateTabCache)
	chrome.tabs.onRemoved.addListener(updateTabCache)
	chrome.tabs.onAttached.addListener(updateTabCache)
	chrome.tabs.onMoved.addListener(updateTabCache)
	chrome.tabs.onCreated.addListener(updateTabCache)
	chrome.windows.onFocusChanged.addListener(updateTabCache)

	chrome.tabs.onActivated.addListener(updateTabLastActivated)


	chrome.extension.onConnect.addListener(function(port) {
		_port = port
		_port.onMessage.addListener(onMessage)
	})

	updateTabCache()
})()