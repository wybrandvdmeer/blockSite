import {process} from './process.js'
import {IDLE_DETECTION_INTERVAL, HEARTBEAT_INTERVAL} from './globals.js'
import {log} from './log.js'

chrome.runtime.onInstalled.addListener(async () => {
    log('Initialize extension')
    var mem = await chrome.storage.local.get('groups')
    if(mem['groups'] == undefined) {
        chrome.storage.local.set({'groups': []})
    }
})

chrome.runtime.onStartup.addListener(async () => {
    process(true)
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    var tab = await chrome.tabs.get(activeInfo.tabId).catch((e) => {
        log('Error')
    })
        
    log('onActivated(' + tab.url + ')')
    process()
})

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    log('onUpdated(' + tab.url + ')')
    process()
})

chrome.windows.onFocusChanged.addListener(async (windowIDEvent) => {
    log('onFocusChanged(wiE: ' + windowIDEvent + ')')
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

chrome.alarms.create('blocksite-alert', { periodInMinutes: HEARTBEAT_INTERVAL })
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'blocksite-alert') {
        log('Heart-beat')
        process()
    }
})