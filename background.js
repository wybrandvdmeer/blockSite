import {initMem, open, close, inActiveInterval, remainingDuration, redirect, hosts2groups, excludeGroups} from './process.js'
import {log, enableLogging, loggerEnabled} from './log.js'

const IDLE_DETECTION_INTERVAL = 180
const HEARTBEAT_INTERVAL = 30000

var locks=[]
var started=false

async function heartBeat() {
    log('set heartbeat')

    var mem = await chrome.storage.local.get('groups'); 
    var groups = mem['groups']
    if(groups.length != 0) {
        /* Close active|audible tabs when necessary. Function call closes also
        admin of tabs which should be closed.
        */
        process()
    }
}

setInterval(heartBeat, HEARTBEAT_INTERVAL)

chrome.runtime.onInstalled.addListener(async () => {
    log('Initialize extension')
    if(await chrome.storage.local.get('groups') == undefined) {
        chrome.storage.local.set({'groups': []})
    }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    var tab = await chrome.tabs.get(activeInfo.tabId).catch((e) => {
        log('Error')
    })

    if(tab != undefined) {
        log('onActivated(' + tab.url + ')')
        process(tab)
    }
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    log('onUpdated(' + tab.url + ')')
    process(tab)
})

chrome.windows.onFocusChanged.addListener(async (windowIDEvent) => {
    log('onFocusChanged(wiE: ' + windowIDEvent + ')')

    if(windowIDEvent == -1) {
        closeGroups()
        return
    }

    process()
})


chrome.idle.setDetectionInterval(IDLE_DETECTION_INTERVAL)

/* States locked and idle are considered in process() to detemine if there is an active window.
I.e. if locked or idle there is no active window. 
*/
chrome.idle.onStateChanged.addListener((ie) => {
    log('onStateChanged(' + ie + ')')
    process()
})

function process(tab) {
    /* To prevent multiple events from same tab initiating the same promise.
    */
    if(tab != undefined && !lock(tab)) {
        return
    }

    chrome.storage.local.get('groups').then(async (mem) => {
        var groups = mem['groups']
        if(groups.length == 0) {
            return
        }

        var saveStarted=false
        if(!started) {
            /* Turn logging on via group. */
            if(!loggerEnabled() && groups.map(g => g.name).filter(n => n == 'debug-group').length == 1) {
                enableLogging()
            }

            saveStarted = initMem(groups)
            started = true
        }
    
        var tabs = await chrome.tabs.query({})
        var hosts2open = getAudibleHosts(tabs)

        var activeTab = await getActiveTabByQuery() // active tab from active window.

        /* Is there an active tab? 
        */
        if(activeTab != undefined) {
            var systemIsActive = await isSystemActive()
            log('System is active:' + systemIsActive)
            
            if(systemIsActive) { 
                var host = getHost(activeTab.url)
                if(host != undefined) {
                    hosts2open.push(host)
                }
            }
        }
        
        var groups2open = hosts2groups(groups, hosts2open)

        var saveOpen=false
        groups2open.forEach(g => {
            if(open(g)) {
                saveOpen = true
            }
        })

        /* Close all other groups.
        */
        var saveClose=false

        excludeGroups(groups, groups2open).forEach(g => {
            if(close(g)) {
                saveClose = true
            }
        })

        if(saveStarted || saveOpen || saveClose) {
            await chrome.storage.local.set({'groups': groups})
        }
    
        redirectTabs(groups, tabs)
        
    }).finally(() => tab != undefined && unlock(tab)); 
}

async function redirectTabs(groups, tabs) {
    var tabs2Check = getAudibleTabs(tabs)

    var activeTabs = tabs.filter((t) => t.active)
    for(var idx=0; idx < activeTabs.length; idx++) {
        if(await isWindowOfTabActive(activeTabs[idx])) {
            tabs2Check.push(activeTabs[idx])
        }
    }

    [...new Set(tabs2Check)].forEach(t => blockUrl(groups, t))
}

function lock(tab) {
    if(locks.includes(tab.id)) {
        return false
    }
    locks.push(tab.id)
    return true
}

function unlock(tab) {
    var pos = locks.indexOf(tab.id)
    if(pos >= 0) {
        locks.splice(pos,1)
    }
}

async function getActiveTabByQuery() {
    var tabs = await chrome.tabs.query({active: true, currentWindow: true})
    if(tabs.length == 1) {
        return tabs[0]
    }
    return undefined
}

function getAudibleTabs(tabs) {
    return tabs.filter(t => t.audible)
}

function getAudibleHosts(tabs) {
    return getAudibleTabs(tabs).map(t => getHost(t.url)).filter(h => h != undefined)
}

function getHost(url) {
    try {
        return new URL(url).host
    } catch(e) {
        return undefined
    }
}

function blockUrl(groups, tab) {
    var host = getHost(tab.url)
    log('blockUrl - check host ' + host)
    for(const g of groups) {
        var site = g.sites.find(e => e == host)
        if(site != undefined && inActiveInterval(g) && remainingDuration(g) <= 0) {
            log('redirect to block-page')
            redirect(tab.id)
            return
        }
    }
}

async function isWindowOfTabActive(tab) {
    return (await chrome.windows.get(tab.windowId)).focused
}

async function isSystemActive() {
    var state = await chrome.idle.queryState(IDLE_DETECTION_INTERVAL)
    return state == 'active'
}

async function closeGroups() {
    chrome.storage.local.get('groups').then(async (mem) => {
        var groups = mem['groups']
        var tabs = await chrome.tabs.query({})
        var save = false

        /* Close all groups, except groups which have audible tabs. 
        */
        excludeGroups(groups, hosts2groups(groups, getAudibleHosts(tabs))).forEach(g => {
            close(g)
            save = true
        })

        if(save) {
            await chrome.storage.local.set({'groups': groups})
        }
    })
}
