(function(){

	const port = chrome.extension.connect({name: "Connection"})
	const input = document.getElementById("search")
	const ul = document.getElementById("tabs")
	const tabOldInterval = 60 * 30 * 1000; // 30 minutes
	var modifiers = {ctrl:false, shift:false}
	var selectedListItemIndex = 0

	const tabModel = {
		tabs:[],
		filteredTabs:[],
		activeTimestamps:{},
		query:"",
		fuse: new Fuse(this.tabs, {
			caseSensitive: false,
			includeScore: false,
			shouldSort: true,
			tokenize: false,
			threshold: 0.6,
			location: 0,
			distance: 100,
			maxPatternLength: 32,
			keys: ["title", "url"]
		}),
		filterTabs: function(query) {
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
		closeTab: function(tabId, callback) {
			chrome.tabs.remove(parseInt(tabId), function() { 
				if (callback) {
					callback()
				}
			})
		},
		activeTimestampForTab: function(tab) {
			if(!tab.id || !this.activeTimestamps[tab.id]) {
				return Date.now()
			}

			return this.activeTimestamps[tab.id];
		}
	}

	const filterTabs = function(query) {
		let shouldClearSelection = tabModel.filterTabs(query)
		createTabList(tabModel, shouldClearSelection)
	}

	const createTabList = function(tabModel, clearSelection) {
		ul.innerHTML = ""
		tabModel.filteredTabs.forEach(function(tab){
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
			li.setAttribute("data-id", tab.id)
			li.appendChild(img)
			li.appendChild(span)
			li.appendChild(closeButton)
			span.innerText = tab.title
			li.addEventListener("click", listItemClicked)

			// Decide whether the tab is old1
			if(Date.now() - tabModel.activeTimestampForTab(tab) > tabOldInterval) {
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
			return parseInt(li.getAttribute("data-id"))
		}
	}

	const handleInput = function(event) {
		if (event.target != input) {
			return
		}

		filterTabs(input.value)
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
				selectTab(selectedListItemIndex)
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
						tabModel.closeTab(li.getAttribute("data-id"), function() {
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

					tabModel.closeTab(li.getAttribute("data-id"), function() {
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

		tabModel.closeTab(li.getAttribute("data-id"), function() {
			li.remove()
		})
	}

	window.setTabs = function(tabs, activeTimestamps) {
		tabModel.tabs = tabs
		tabModel.filteredTabs = tabs
		tabModel.activeTimestamps = activeTimestamps
		createTabList(tabModel, true)

	}

	const load = function(event) {
		port.postMessage({
			command: "request-tabs"
		})
	}

	window.addEventListener("input", handleInput, true)
	window.addEventListener("blur", blur, true)
	window.addEventListener("keydown", keyDown, true)
	window.addEventListener("load", load, true)

	input.focus()
})()