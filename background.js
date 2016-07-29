(function(){

	var _tabs = [];
	var _filteredTabs = [];
	var _query = "";
	var _port
	var fuse = new Fuse(_tabs, {
		caseSensitive: false,
		includeScore: false,
		shouldSort: true,
		tokenize: false,
		threshold: 0.6,
		location: 0,
		distance: 100,
		maxPatternLength: 32,
		keys: ["title", "url"]
	});

	const selectTab = function(index) {
		var tabId = _filteredTabs[index].id;
		chrome.tabs.update(tabId, {highlighted: true, active:true})
	}

	const updateTabs = function(callback) {
		chrome.tabs.query({currentWindow:true}, function(tabs) {
			_tabs = tabs;
			if (callback) {
				callback();	
			}
		})
	}

	const onTabCreatedOrUpdated = function() {
		updateTabs()
	}

	const filterTabs = function(query) {
		if (query == _query) {
			return false;
		}

		_query = query;

		if (!_query || _query == "") {
			_filteredTabs = _tabs;
		} else {
			fuse.set(_tabs);
			_filteredTabs = fuse.search(_query)
			return true;
		}

		return false;
	}

	const sendTabs = function(refresh) {
		refresh = refresh || false;
		var popups = chrome.extension.getViews({type: "popup"});
		if (!popups || popups.length == 0) {
			return;
		}

		popups[0].updateTabs(_filteredTabs, refresh);
	}

	const onMessage = function(message) {
		if (message.command == "filter-tabs") {
			var refresh = filterTabs(message.value);
			sendTabs(refresh);	
		} else if (message.command == "select-tab") {
			selectTab(message.value);
		}
	}

	const onWindowFocusChanged = function() {
		sendTabs(true);
	}

	chrome.tabs.onUpdated.addListener(onTabCreatedOrUpdated);
	chrome.tabs.onCreated.addListener(onTabCreatedOrUpdated);
	chrome.windows.onFocusChanged.addListener(onWindowFocusChanged);

	chrome.extension.onConnect.addListener(function(port) {
		_port = port;
		_port.onMessage.addListener(onMessage);
		updateTabs(function() {
			filterTabs();
			sendTabs()
		});
	});

	
	
})();