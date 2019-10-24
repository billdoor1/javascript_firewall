var tab = null;

function td_click(event)
{
	td_change_rule(event.currentTarget, $("context").value, event.currentTarget.id.slice(0, -1));
}

function show_rules()
{
	let origin = $("context").value;
	let table_counters = $("counters");
	table_counters.innerHTML = '';

	[0, 1, 2].forEach(i => $("*" + i).className = status[request_allow(origin, "*", i)]);	
	for (let hostname of Object.keys(tab.hostnames).sort(compare_hostnames))
	{
		let counters = tab.hostnames[hostname];
		let colors = [0, 1, 2].map(i => status[request_allow(origin, hostname, i)]);
		let border = hostname.split(".").length == 2 ? 'domain' : '';
		let highlight = hostname == tab.origin ? 'highlight' : '';
		
		let tr = document.createElement("tr");
		tr.innerHTML = `<td class="hostname ${border} ${highlight}">${hostname}</td>
			<td class="${colors[0]}" id="${hostname}0">${counters[0] || ''}</td>
			<td class="${colors[1]}" id="${hostname}1">${counters[1] || ''}</td>
			<td class="${colors[2]}" id="${hostname}2">${counters[2] || ''}</td>`;
		table_counters.appendChild(tr);
		[0, 1, 2].forEach(i => $(hostname + i).onclick = td_click);
	}
	
	if (document.body.scrollHeight > 600)
		document.body.style.overflowY = "scroll";
}

browser.tabs.query({ currentWindow: true, active: true }).then(tabs => {
	tab = browser.extension.getBackgroundPage().counters[tabs[0].id];
	if (tab && new URL(tabs[0].url).hostname == tab.origin)
	{
		for (let h = tab.origin; h.includes("."); h = h.slice(h.indexOf(".") + 1))
			$("context").insertAdjacentHTML('beforeend', `<option value="${h}">${h}</option>`);
		$("context").insertAdjacentHTML('beforeend', '<option value="*">all websites</option>');
		
		if (!browser.extension.getBackgroundPage().enabled)
			$("disabled").classList.remove("hidden");
		$("table").classList.remove("hidden");
		$("error").classList.add("hidden");
		
		$("context").onchange = show_rules;
		$("reload").onclick = () => { browser.tabs.reload(); window.close(); };
		$("options").onclick = () => { browser.runtime.openOptionsPage(); window.close(); };
		$("disable").onclick = () => { browser.runtime.sendMessage([]); $("disabled").classList.toggle("hidden"); };
		$("delete").onclick = () => { browser.runtime.sendMessage([tab.origin]).then(show_rules); };
		[0, 1, 2].forEach(i => $("*" + i).onclick = td_click);
		
		show_rules();
	}
});