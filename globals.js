export const IDLE_DETECTION_INTERVAL = 180
export const HEARTBEAT_INTERVAL = 1 // Minutes
export const HEARTBEAT_SLACK = 30 * 1000

export var started=false

export function start() {
    started = true
}

export function reset() {
    started = false
}
