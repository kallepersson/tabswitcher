(function(){

	const port = chrome.extension.connect({name: "Connection"})
	const input = document.getElementById("search")
	const ul = document.getElementById("tabs")
	const tabOldInterval = 60 * 30 * 1000; // 30 minutes
	var modifiers = {ctrl:false, shift:false}
	var selectedListItemIndex = 0
	var messageBar = document.getElementById("message")

	const tabController = {
		tabs:[],
		filteredTabs:[],
		activeTimestamps:{},
		query:"",
		fuse: new Fuse(this.tabs, {
			caseSensitive: false,
			includeScore: false,
			shouldSort: true,
			tokenize: false,
			threshold: 0.5,
			location: 0,
			distance: 100,
			maxPatternLength: 32,
			keys: ["title", "url"]
		}),
		filterTabs: function(query) {
			query = query.split(":")[0];

			if (query == this.query) {
				return false
			}

			this.query = query

			if (!this.query || this.query == "") {
				this.filteredTabs = this.tabs
			} else {
				this.fuse.set(this.tabs)
				this.filteredTabs = this.fuse.search(this.query)
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
		closeTabs: function(callback) {
			let tabIds = this.filteredTabs.map(function(tab){
				return parseInt(tab.id)
			})
			this.removeTabsFromModel(tabIds)
			chrome.tabs.remove(tabIds, function() { 
				getElementsForTabIds(tabIds).forEach(function(elm) {
					elm.remove()
				})
				if (callback) {
					callback()
				}
			})
		},
		deduplicateTabs: function(callback) {
			if (callback) {
				callback()
			}
		},
		reloadTabs: function(callback) {
			if (callback) {
				callback()
			}
		},
		detachTabs: function(callback) {
			if (callback) {
				callback()
			}
		},
		activeTimestampForTab: function(tab) {
			if(!tab.id || !this.activeTimestamps[tab.id]) {
				return Date.now()
			}

			return this.activeTimestamps[tab.id];
		}
	}

	const commandMap = {
		close: tabController.closeTabs,
		detach: tabController.detachTabs,
		reload: tabController.reloadTabs,
		deduplicate: tabController.deduplicateTabs
	}

	const filterTabs = function(query) {
		let shouldClearSelection = tabController.filterTabs(query)
		createTabList(tabController, shouldClearSelection)
	}

	const createTabList = function(tabController, clearSelection) {
		ul.innerHTML = ""
		tabController.filteredTabs.forEach(function(tab){
			var li = document.createElement("li")
			var img = document.createElement("img")
			// Don"t support chrome:// urls for favicons since they won't load
			if (tab.favIconUrl && tab.favIconUrl.indexOf('chrome://') == -1) {
				img.src = tab.favIconUrl
			} else {
				img.src = "icons/favicon.png"
			}
			var span = document.createElement("span")
			var closeButton = document.createElement("button")
			closeButton.addEventListener('click', closeButtonClicked)
			li.id = tab.id
			li.appendChild(img)
			li.appendChild(span)
			li.appendChild(closeButton)
			span.innerText = tab.title
			li.addEventListener("click", listItemClicked)

			// Decide whether the tab is old1
			if(Date.now() - tabController.activeTimestampForTab(tab) > tabOldInterval) {
				li.classList.add("old")
			}

			ul.appendChild(li)
		})

		if (clearSelection) {
			selectedListItemIndex = 0
		}

		updateSelection()
	}

	const tabIdForIndex = function(index) {
		let items = ul.querySelectorAll("li")
		let li = items[index]
		if (li) {
			return parseInt(li.id)
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
		if (event.target != input) {
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
				executeInput(input.value)
			break
			case "Escape":
				if (input.value == "") {
					window.close()
				}
			break
			case "ControlLeft":
				modifiers.ctrl = true
			break
			case "ShiftLeft":
				modifiers.shift = true
			break
			case "KeyX":
			if (modifiers.ctrl) {
				// Holding shift closes all old tabs
				if (modifiers.shift) {
					[].forEach.call(ul.querySelectorAll(".old"), function(li) {
						tabController.closeTabs([li.id], function() {
							li.remove()
							updateSelection()
						})
					})
				} else {
					// Otherwise close selected tab
					var li = ul.querySelector(".selected")
					if (!li) {
						return
					}

					tabController.closeTabs([li.id], function() {
						li.remove()
						updateSelection()
					})
				}
			}
			break
		}

		updateSelection()
	}

	const updateSelection = function() {
		var selected = ul.querySelector(".selected")
		var items = ul.querySelectorAll("li")


		if (selected) {
			selected.classList.remove("selected")
		}

		if (selectedListItemIndex < items.length) {
			items.item(selectedListItemIndex).classList.add("selected")
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
		chrome.tabs.update(tabId, {highlighted: true, active:true})
		window.close()
	}

	const blur = function(event) {
		input.focus()
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
		var index = [].indexOf.call(event.target.parentNode.children, event.target)

		if (index == -1) {
			return
		}

		selectedListItemIndex = index
		updateSelection()
	}

	const closeButtonClicked = function(event) {
		event.stopPropagation()

		if (event.button != 0) {
			return
		}

		let li = event.target.parentNode
		let ul = li.parentNode
		let index = [].indexOf.call(ul.children, li)

		if (index == -1) {
			return
		}

		tabController.closeTabs([li.id], function() {
			li.remove()
		})
	}

	const updateMessageBar = () => {
		if ((input.value.indexOf(":") != -1)) {
			messageBar.classList.add("showing")
		} else {
			messageBar.classList.remove("showing")
		}
	}

	const handleInput = function(event) {
		if (event.target != input) {
			return
		}

		updateMessageBar();

		filterTabs(input.value)
	}

	const parseInputCommands = function(inputText) {
		return inputText.split(":");
	}

	const executeInput = function(inputText) {

		let commands = parseInputCommands(inputText)

		if (inputText.charAt(0) != ":") {
			
			// If this is just a query string with no commands, just select the tab
			if (commands.length == 1) {
				selectTab(selectedListItemIndex)
				return;
			}

			// If inputText string starts without a command, it's a query so remove it
			commands.splice(0, 1);
		}

		// start processing list of commands and manipulate model
		commands.forEach(function(command){
			let commandMethod = commandMap[command]
			if (commandMethod) {
				commandMethod.bind(tabController).call()
				//tabController[commandMap[command]]()
			}
		})

		resetInput()
	}

	const resetInput = () => {
		input.value = ""
		filterTabs(input.value)
	}

	const load = (event) => {
		port.postMessage({
			command: "request-tabs"
		})
	}

	window.setTabs = function(tabs, activeTimestamps) {
		tabController.tabs = tabs
		tabController.filteredTabs = tabs
		tabController.activeTimestamps = activeTimestamps
		createTabList(tabController, true)
	}

	window.addEventListener("input", handleInput, true)
	window.addEventListener("mouseover", listItemHovered, true)
	window.addEventListener("blur", blur, true)
	window.addEventListener("keydown", keyDown, true)
	window.addEventListener("load", load, true)

	input.focus()
})()