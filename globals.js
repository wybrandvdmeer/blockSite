export const IDLE_DETECTION_INTERVAL = 180
export const HEARTBEAT_INTERVAL = 30000

export var started=false

export function start() {
    started = true
}

export function reset() {
    started = false
}
