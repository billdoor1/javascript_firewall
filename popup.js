var tab = null;

function td_click(event)
{
	td_change_rule(event.currentTarget, $("context").value, event.currentTarget.id.slice(0, -1));
}

function update_scrollbar()
{
	window.removeEventListener("resize", update_scrollbar);
	document.body.style.overflowY = document.body.scrollHeight > 600 ? "scroll" : "auto";
	setTimeout(() => window.addEventListener("resize", update_scrollbar), 500);
}

function show_rules()
{
	let origin = $("context").value;
	let table_counters = $("counters");
	table_counters.innerHTML = '';

	[0, 1, 2].forEach(i => $("*" + i).className = status[request_allow(origin, "*", i)]);
	let tab_origin = new URL(tab.url).hostname;
	for (let hostname of Object.keys(tab[tab.url]).sort(compare_hostnames))
	{
		let counters = tab[tab.url][hostname];
		let colors = [0, 1, 2].map(i => status[request_allow(origin, hostname, i)]);
		let border = hostname.split(".").length == 2 ? 'domain' : '';
		let highlight = hostname == tab_origin ? 'highlight' : '';
		
		let tr = document.createElement("tr");
		tr.innerHTML = `<td class="hostname ${border} ${highlight}">${hostname}</td>
			<td class="${colors[0]}" id="${hostname}0">${counters[0] || ''}</td>
			<td class="${colors[1]}" id="${hostname}1">${counters[1] || ''}</td>
			<td class="${colors[2]}" id="${hostname}2">${counters[2] || ''}</td>`;
		table_counters.appendChild(tr);
		[0, 1, 2].forEach(i => $(hostname + i).onclick = td_click);
	}
}

browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
	let url = new URL(tabs[0].url); url = url.origin + url.pathname + url.search;
	tab = background ? background.counters[tabs[0].id] : null;
	if (tab && tab.hasOwnProperty(url))
	{
		tab.url = url;
		for (let h = new URL(tab.url).hostname; h.includes("."); h = h.slice(h.indexOf(".") + 1))
			$("context").insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`);
		$("context").insertAdjacentHTML('beforeend', '<option value="*">all websites</option>');
		
		$("context").onchange = show_rules;
		$("reload").onclick = () => { browser.tabs.reload(); window.close(); };
		$("options").onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
		$("disable").onclick = () => { browser.runtime.sendMessage([tabs[0].id]); $("disabled").classList.toggle("hidden"); };
		$("delete").onclick = () => { browser.runtime.sendMessage([new URL(tab.url).hostname]).then(show_rules); };
		[0, 1, 2].forEach(i => $("*" + i).onclick = td_click);
		
		window.addEventListener("resize", update_scrollbar);
		if (!tab.enabled)
			$("disabled").classList.remove("hidden");
		$("table").classList.remove("hidden");
		show_rules();
	}
	else
	{
		let error_id = !background ? "error_private" : tab && tab.url == url ? "error_restricted" : "error_reload";
		$(error_id).classList.remove("hidden");
	}
});