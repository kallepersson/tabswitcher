document.addEventListener("DOMContentLoaded", () => {
	var checkbox = document.getElementById("showTabsFromAllWindows");
	
	checkbox.addEventListener("change", (evt) => {
		chrome.storage.sync.set({showTabsFromAllWindows:checkbox.checked})
	});			

	chrome.storage.sync.get({showTabsFromAllWindows:true}, (items) => {
		checkbox.checked = items.showTabsFromAllWindows;
	});

});