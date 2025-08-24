var logging = false

export function enableLogging() {
    logging = true
}

export function disableLogging() {
    logging = false
}

function formatTime(number) {
    return number < 10 ? '0' + number : number;
}

export function log(message) {
    if(logging) {
        var now = new Date();
        var hours = formatTime(now.getHours());
        var minutes = formatTime(now.getMinutes());
        var seconds = formatTime(now.getSeconds());

        console.log(`${hours}:${minutes}:${seconds} - ${message}`);
    }
}