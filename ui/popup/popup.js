import {Group} from '../../data.js'

dynamicHtml()

function dynamicHtml() {
    document.getElementById('redirect-to-settings').addEventListener('click', () => {
        var url = chrome.runtime.getURL('ui/settings/settings.html')
        chrome.tabs.create({url : url})
    });

    document.getElementById('block-site').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }).then( (tabs) => {
            if(tabs[0].url == undefined) {
                return;
            }

            var host;
            try {
                var url = new URL(tabs[0].url)
                if(url.protocol != undefined && url.protocol.startsWith('chrome')) {
                    return;
                }
                host = url.host
            } catch(e) {
                return;
            }
    
            chrome.storage.local.get('groups').then(mem => {
                var groups = mem['groups'];

                for(const g of groups) {
                    if(g.name == host) {
                        return;
                    }
                }
                var idx = groups.length;
                var group = new Group(idx, host, [host], 0, 0, '0000', '2359', [0,1,2,3,4,5,6], null);
                groups.push(group);
                chrome.storage.local.set({'groups': groups});
            });
        }); 
    });
}
