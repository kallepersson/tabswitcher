(function(){

	const inputField = document.getElementById("search")
	const ul = document.getElementById("tabs")
	let draggedItem = null
	var modifiers = {ctrl:false, shift:false}
	var selectedListItemIndex = 0
	var actionBar = document.getElementById("actionBar")
	var messageLabel = document.getElementById("messageLabel")
	var actionMenu = document.getElementById("actionMenu")
	var hoverLock = false;
	var containerScrollOffset = 0;

	const tabController = {
		tabs:[],
		filteredTabs:[],
		query:"",
		fuse: new Fuse(this.tabs, {
			caseSensitive: false,
			includeScore: false,
			shouldSort: true,
			tokenize: false,
			threshold: 0.2,
			location: 0,
			distance: 100,
			maxPatternLength: 32,
			keys: ["title", "url"]
		}),
		getFilteredTabIds: function() {
			return this.filteredTabs.map(function(tab){
				return parseInt(tab.id)
			})
		},
		filterTabs: function(query) {
			query = query.split(":")[0];

			if (query == this.query) {
				return false
			}

			let reverseFilter = query.charAt(0) == "!"
			if (reverseFilter) {
				query = query.substring(1)
			}

			this.query = query

			if (!this.query || this.query == "") {
				this.filteredTabs = this.tabs
			} else {
				this.fuse.setCollection(this.tabs)
				let filteredTabs = this.fuse.search(this.query)
				if (reverseFilter) {
					filteredTabs = this.tabs.filter(function(tab){
						return filteredTabs.indexOf(tab) == -1
					})
				}

				this.filteredTabs = filteredTabs
				return true
			}

			return false // list did change
		},
		removeTabsFromModel: function(tabIds) {
			this.tabs = this.tabs.filter(function(tab) {
				return (tabIds.indexOf(tab.id) == -1)
			})
			this.filteredTabs = this.filteredTabs.filter(function(tab) {
				return (tabIds.indexOf(tab.id) == -1)
			})
		},
		closeTabs: function(tabIds) {
			// Default to visible tabs if tabIds is empty
			if (!tabIds) {
				tabIds = this.filteredTabs.map(function(tab){
					return parseInt(tab.id)
				})
			}
			this.removeTabsFromModel(tabIds)
			chrome.tabs.remove(tabIds, () => { 
				getElementsForTabIds(tabIds).forEach(function(elm) {
					elm.remove()
				})
			});
			window.setTimeout(updateLabels, 300);
		},
		deduplicateTabs: function() {
			let tabIdsToClose = []
			let collectedURLs = []
			this.filteredTabs.forEach(function(tab) {
				// Get rid of # – might be a mistake
				let url = tab.url.split("#")[0]
				if (collectedURLs.indexOf(url) == -1) {
					collectedURLs.push(url)
				} else {
					tabIdsToClose.push(tab.id)
				}
			})
			this.closeTabs(tabIdsToClose)
		},
		sortTabs: function() {
			this.filteredTabs = this.filteredTabs.sort(function(a, b) {
				return a.url.localeCompare(b.url)
			})
			this.filteredTabs.forEach(function(tab, i) {
				chrome.tabs.move(tab.id, {index:i})
				ul.appendChild(document.getElementById(tab.id));
			})
		},
		reloadTabs: function() {
			this.getFilteredTabIds().forEach(function(tabId) {
				chrome.tabs.reload(tabId)
			})
		},
		detachTabs: function() {
			let tabIds = this.getFilteredTabIds()
			let firstTabId = tabIds[0]
			// Create a window with an empty tab, then move them, then close the first tab
			chrome.windows.create({}, function(win) {
				if (tabIds.length > 0) {
					chrome.tabs.move(tabIds, {windowId: win.id, index: -1})
				}
				chrome.tabs.remove(win.tabs[0].id)
			})
		}
	}

	const commandMap = {
		close: tabController.closeTabs,
		x: tabController.closeTabs,
		detach: tabController.detachTabs,
		win: tabController.detachTabs,
		reload: tabController.reloadTabs,
		re: tabController.reloadTabs,
		deduplicate: tabController.deduplicateTabs,
		dd: tabController.deduplicateTabs,
		sort: tabController.sortTabs,
	}

	const filterTabs = function(query) {
		let shouldClearSelection = tabController.filterTabs(query)
		createTabList(tabController, shouldClearSelection)
	}

	const mouseDown = function(evt) {
		draggedItem = evt.target;
		draggedItem.classList.add("dragging");
	}

	const mouseUp = function(evt) {
		if (!draggedItem || !evt.target || evt.target.tagName != "LI") {
			return;
		}
		let tabId = parseInt(draggedItem.id)
		let windowId = parseInt(evt.target.dataset.windowId)
		let index = parseInt(evt.target.dataset.index)
		if (index < draggedItem.dataset.index) {
			index += 1;
		}
		chrome.tabs.move(tabId, {windowId:windowId, index:index}, function(tab) {
			chrome.runtime.sendMessage({data:"forceReload"});

			window.setTimeout(function() {
				reloadTabs(false);
			}, 100);
		});
		draggedItem = null
		document.querySelectorAll("li.dropTarget").forEach(elm => {
			elm.classList.remove("dropTarget")
		});
		document.querySelectorAll("li.dragging").forEach(elm => {
			elm.classList.remove("dragging")
		});
	}

	const mouseMove = function(evt) {
		if (!draggedItem || !evt.target || evt.target.tagName != "LI") {
			return;
		}
		document.querySelectorAll("li.dropTarget").forEach(elm => {
			elm.classList.remove("dropTarget")
		})
		evt.target.classList.add("dropTarget")
	}

	const createTabList = function(tabController, clearSelection, resetScroll) {
		ul.innerHTML = ""
		ul.addEventListener("mousemove", mouseMove);
		var lastWindowId = ""
		var tabIndex = 0;
		tabController.filteredTabs.forEach(function(tab, i){
			var li = document.createElement("li")
			var img = document.createElement("img")
			// Don't support chrome:// urls for favicons since they won't load
			if (tab.favIconUrl && tab.favIconUrl.indexOf('chrome://') == -1) {
				img.src = tab.favIconUrl
			} else {
				img.src = "icons/favicon.png"
			}
			var span = document.createElement("span")
			var closeButton = document.createElement("button")
			closeButton.addEventListener('click', closeButtonClicked)
			closeButton.innerText = "✕";
			li.id = tab.id
			li.dataset.url = tab.url
			li.dataset.windowId = tab.windowId
			// Add thicker borders to indicate window groups
			if (tab.windowId != lastWindowId) {
				if (i != 0) {
					li.classList.add("newWindow")
					tabIndex = 0;
				}
				lastWindowId = tab.windowId
			}
			li.dataset.index = tabIndex
			var div = document.createElement("div")
			li.appendChild(div)
			div.appendChild(img)
			div.appendChild(span)
			div.appendChild(closeButton)
			span.innerText = tab.title; 
			li.addEventListener("click", listItemClicked)
			li.addEventListener("mousedown", mouseDown);
			li.addEventListener("mouseup", mouseUp);
			ul.appendChild(li)
			tabIndex++;
		})

		if (clearSelection) {
			selectedListItemIndex = 0
		}

		if (resetScroll) {
			updateSelection(true)
		}
	}

	const tabIdForIndex = function(index) {
		let items = ul.querySelectorAll("li")
		let li = items[index]
		if (li) {
			return parseInt(li.id)
		}
	}

	const windowIdForTabIndex = function(index) {
		let items = ul.querySelectorAll("li")
		let li = items[index]
		if (li) {
			return parseInt(li.dataset.windowId);
		}
	}

	const keyUp = function(event) {
		if (event.code == "ControlLeft") {
			modifiers.ctrl = false
		} else if (event.code = "ShiftLeft") {
			modifiers.shift = false;
		}
	}

	const keyDown = function(event) {
		if (event.target != inputField) {
			return
		}

		var items = ul.querySelectorAll("li")

		switch (event.code) {
			case "ArrowDown":
				if (selectedListItemIndex < items.length - 1) {
					selectedListItemIndex++
				} else {
					selectedListItemIndex = 0
				}
			break
			case "ArrowUp":
				if (selectedListItemIndex > 0) {
					selectedListItemIndex--
				} else {
					selectedListItemIndex = items.length - 1
				}
			break
			case "Enter":
				executeInput(inputField.value)
			break
			case "Escape":
				if (inputField.value == "") {
					window.close()
				}
			break
			case "ControlLeft":
				modifiers.ctrl = true
			break
			case "ShiftLeft":
				modifiers.shift = true
			break
		}

		hoverLock = true;

		updateSelection(true)
	}

	const updateSelection = function(scrollIntoView) {
		var selected = ul.querySelector(".selected")
		var items = ul.querySelectorAll("li")

		if (selected) {
			selected.classList.remove("selected")
		}

		if (selectedListItemIndex < items.length) {
			let element = items.item(selectedListItemIndex)
			element.classList.add("selected")
			if (scrollIntoView) {
				window.scrollTo(0, element.offsetTop - containerScrollOffset);
			}
		}
	}

	const getElementsForTabIds = function(tabIds) {
		return tabIds.map(function(tabId) {
			return document.getElementById(tabId)
		}).filter(function(tabElement) {
			return tabElement != null
		})
	}
	
	const selectTab = function(index) {
		var tabId = tabIdForIndex(index)
		var windowId = windowIdForTabIndex(index)
		chrome.tabs.update(tabId, {highlighted: true, active:true});
		chrome.windows.update(windowId, {focused: true});
	}

	const blur = function(event) {
		inputField.focus()
	}

	const listItemClicked = function(event) {
		if (event.button != 0) {
			return
		}

		var index = [].indexOf.call(event.target.parentNode.children, event.target)

		if (index == -1) {
			return
		}

		selectTab(index)
	}

	const listItemHovered = function(event) {
		if (event.target.parentNode != ul) {
			return
		}

		var index = [].indexOf.call(event.target.parentNode.children, event.target)

		if (index == -1 || hoverLock) {
			return
		}

		selectedListItemIndex = index
		updateSelection(false)
	}

	const closeButtonClicked = function(event) {
		event.stopPropagation()

		if (event.button != 0) {
			return
		}

		let li = event.target.parentNode.parentNode
		let ul = li.parentNode
		let index = [].indexOf.call(ul.children, li)

		if (index == -1) {
			return
		}
		tabController.closeTabs([parseInt(li.id)], function() {
			li.remove()
		})
	}

	const updateLabels = () => {
		let message = ""
		if ((inputField.value.indexOf(":") != -1) && inputField.value.length > 1) {
			// TODO Only extract valid commands and list them
			message += "Press &#9166; to "
			let commands = parseCommandsFromInput(inputField.value)
			if (commands.length > 1) {
				message += commands.join(", ")
			} else {
				message += commands[0]
			}
			message += " " + generateNumberOfTabsLabel()
			message += "."
		} else {
			message += " " + generateNumberOfTabsLabel()
			message += " matching"
		}
		messageLabel.innerHTML = message

		Array().forEach.call(document.querySelectorAll(".placeholder"), function(span) {
			span.innerHTML = generateNumberOfTabsLabel()
		})
	}

	const handleClick = (event) => {
		if (event.target.id != "button-menu") {
			actionMenu.classList.remove("active");
		}
	}

	const handleInput = function(event) {
		if (event.target != inputField) {
			return
		}

		filterTabs(parseQueryFromInput(inputField.value))

		let filterNotEmpty = inputField.value.length > 0;
		let filterMatchesTabs = tabController.filteredTabs.length > 0;
		document.getElementById("actionBar").classList.toggle("visible", filterNotEmpty && filterMatchesTabs);
		document.getElementById("filterMessage").classList.toggle("visible", !filterMatchesTabs);

		updateLabels();
	}

	const handleScroll = function(event) {
		document.body.classList.toggle("scrolled", window.scrollY > 0);
	}

	const parseCommandsFromInput = function(inputText) {
		let commands = inputText.split(":");

		// If inputText string starts without a command, it's a query so remove it
		if (inputText.charAt(0) != ":") {
			commands.splice(0, 1);
		}
		return commands.filter((command) => {
			return command.length > 0
		});
	}

	const parseQueryFromInput = function(inputText) {
		// If inputText starts with a : there is no query to filter by
		if (inputText.charAt(0) == ":") {
			return ""
		}

		let commands = inputText.split(":");
		return commands[0];
	}

	const executeInput = function(inputText) {
		let commands = parseCommandsFromInput(inputText)
		// If this is just a query string with no commands, just select the tab
		let query = parseQueryFromInput(inputText)

		if (commands.length == 0) {
			selectTab(selectedListItemIndex)
			return;
		}

		// start processing list of commands and manipulate model
		commands.forEach(function(command) { 
			executeCommand(command)
		})

		resetInput()
	}

	const executeCommand = (command) => {
		let commandMethod = commandMap[command]
		if (commandMethod) {
			commandMethod.bind(tabController).call()
		}
	}

	const resetInput = () => {
		inputField.value = ""
		filterTabs(parseQueryFromInput(inputField.value))
		updateLabels()
	}

	const generateNumberOfTabsLabel = () => {
		return tabController.filteredTabs.length + " " + (tabController.filteredTabs.length == 1 ? "tab" : "tabs")
	}

	const setTabs = (tabs, resetScroll) => {
		if (!tabs || !tabs.length) {
			return;
		}

		tabController.tabs = tabs
		tabController.filteredTabs = tabs
		createTabList(tabController, true, resetScroll)
		updateLabels()
	}

	const reloadTabs = function(callback, resetScroll) {
		chrome.storage.local.get(["tabs"], function(result) {
			setTabs(result.tabs, resetScroll);
			if (callback) {
				callback()
			}
		});	
	}

	const handleDOMReady = () => {
		inputField.focus()
		containerScrollOffset = parseInt(window.getComputedStyle(document.getElementById("tabs")).getPropertyValue("padding-top"));

		let buttons = document.querySelectorAll("#buttonWrapper button, #actionMenu button")
		Array().forEach.call(buttons, function(button) {
			if (button.dataset.commands) {
				button.addEventListener("click", (event) => {
					event.target.dataset.commands.split(",").forEach((command) => {
						executeCommand(command)
					})
				})
			}
		})
		document.getElementById("button-menu").addEventListener("click", (event) => {
			actionMenu.classList.add("active");
		})

		reloadTabs(true)
	}

	window.addEventListener("DOMContentLoaded", handleDOMReady, true)
	window.addEventListener("input", handleInput, true)
	window.addEventListener("click", handleClick, true)
	window.addEventListener("mouseover", listItemHovered, true)
	window.addEventListener("blur", blur, true)
	window.addEventListener("scroll", handleScroll, true)
	window.addEventListener("keydown", keyDown, true)
	window.addEventListener("mousemove", () => {
		hoverLock = false
	}, true)
})()