(function(){

	const port = chrome.extension.connect({name: "Sample Communication"})
	const input = document.getElementById("search")
	const ul = document.getElementById("tabs")
	var _selectedItemIndex = 0

	const updateTabs = function(tabs, refresh) {
		ul.innerHTML = ""
		tabs.forEach(function(tab){
			var li = document.createElement("li")
			var img = document.createElement("img")
			// Don't support chrome:// urls for favicons since they won't load
			if (tab.favIconUrl && tab.favIconUrl.indexOf('chrome://') == -1) {
				img.src = tab.favIconUrl
			}
			var span = document.createElement("span")
			li.appendChild(img)
			li.appendChild(span)
			span.innerText = tab.title
			ul.appendChild(li)
		})

		if (refresh) {
			_selectedItemIndex = 0;
		}

		updateSelection()
	}

	window.updateTabs = updateTabs

	const keyUp = function(event) {
		if (event.target != input) {
			return
		}

		port.postMessage({
			command: "filter-tabs",
			value: input.value
		})
	}

	const keyDown = function(event) {
		if (event.target != input) {
			return
		}

		var items = ul.querySelectorAll("li")

		switch (event.code) {
			case "ArrowDown":
				if (_selectedItemIndex < items.length - 1) {
					_selectedItemIndex++
				} else {
					_selectedItemIndex = 0
				}
			break
			case "ArrowUp":
				if (_selectedItemIndex > 0) {
					_selectedItemIndex--
				} else {
					_selectedItemIndex = items.length - 1
				}
			break
			case "Enter":
				selectTab(_selectedItemIndex)
			break
			case "Escape":
				if (input.value == "") {
					window.close()
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

		if (_selectedItemIndex < items.length) {
			items.item(_selectedItemIndex).classList.add("selected")
		}
	}
	
	const selectTab = function(i) {
		port.postMessage({
			command: "select-tab",
			value: i
		})
	}

	const blur = function(event){
		input.focus()
	}

	window.addEventListener("keyup", keyUp, true)
	window.addEventListener("blur", blur, true)
	window.addEventListener("keydown", keyDown, true)
})()