/* jodash.js - Dashboard-Grundfunktionen, sozusagen ein
* 'Schweizer Taschenmesser' fuer meine Webanwendungen
* bei denen 'meistens' ein Sidebar/Menue vorhandnen ist.
*
* Basisfunktionalitaet fuer Buttons, Sidebar, Dialoge, Sound, ..
* Enthaelt nichts international relevantes 
*
* Falls Button mit id='joInstallApp' vorhanden, kann dieser 
* die Installation der Software als APP ausloesen! Ein Eventhandler wird in diesem Fall
* automatisch erzeugt.
*/

export const VERSION = 'V0.16 / 12.01.2025'
export const COPYRIGHT = '(C)JoEmbedded.de'

//---- helpers----
export async function dashSleepMs(ms = 1) { // use: await qrSleepMs()
    let np = new Promise(resolve => setTimeout(resolve, ms))
    return np
}

let sidebarState = 0 /* Global, static: 0:Expanded 1:Shrinked 2:Hidden  (3:Exp, 4:Shrinked, 5:Hidden*)*/

// Sidebar CLose/Klein/Open
async function sidebarClick(shift = true) {
    const nb = document.querySelector('.jo-sidebar').classList
    if (shift) sidebarState = (sidebarState + 1) % 3 // Move to next state
    switch (sidebarState) {
        case 0:
            nb.remove("jo-sidebar-hidden")
            await dashSleepMs(1) // else no scroll-in
            nb.remove("jo-sidebar-small")
            break;
        default:
        case 1:
            nb.add("jo-sidebar-small")
            nb.remove("jo-sidebar-hidden")
            break;
        case 2:
            nb.add("jo-sidebar-small")
            nb.add("jo-sidebar-hidden")
            break;
    }

    // Direction-Hint: LEFT-/RIGHT POINTING POINTER
    const sbh = ['180deg', '180deg', '0deg', '90deg', '90deg', '0deg']
    document.querySelector('.jo-main-hambind').style.rotate = sbh[sidebarState]
}


/* Font setzen - Wichtig dabei nochmal Grenzen checken */
export function dashSetFont(nrel) {
    if (nrel < 0.5) nrel = 0.5
    else if (nrel > 2) nrel = 2
    document.documentElement.style.setProperty('--fontrel', nrel)
    sidebarMax(0.33)
    return nrel
}

/* Themen invertieren hell-dunkel */
export function dashToggleTheme() {
    // Erstmal nur Helligkeitswerte invertieren
    const cvar = [
        '--white100',
        '--txtwhite97',
        '--whitegray94',
        '--lightgray88',
        '--infogray82',
        '--hovergray75',
        '--silvergray69',
        '--menugray63',
        '--midgray50',
        '--lowmidgray38',
        '--darkgray25',
        '--nightgray13',
        '--txtblack3',
        '--black0',
    ]
    cvar.forEach((e) => {
        const oval = parseInt(getComputedStyle(document.documentElement).getPropertyValue(e).substring(1), 16);
        const nval = '#' + (oval ^ 0xFFFFFF).toString(16).padStart(6, '0') // Invert
        document.documentElement.style.setProperty(e, nval)
    })
}

// Audio-Modul fuer Pings, aehnlich im blx.js
let acx
export function joPing(frq = 1000, dura = 0.1, vol = 0.1) {
    if (!acx) acx = new AudioContext()
    const oscillator = acx.createOscillator()
    oscillator.frequency.value = frq
    const volume = acx.createGain()
    volume.gain.value = vol
    volume.gain.exponentialRampToValueAtTime(vol / 5, acx.currentTime + dura)
    oscillator.connect(volume)
    volume.connect(acx.destination)
    oscillator.type = 'square'
    oscillator.start()
    oscillator.stop(acx.currentTime + dura)
}
export function joPingError() { // Shortcut - Allg. fuer Fehler
    joPing(30, 0.3, 0.15)
}
export function joPingChords(frq = 880, dur = 0.3, vol = 0.05) { // Dur Akkord
    joPing(frq, dur, vol)
    joPing(frq * 1.259, dur, vol)
    joPing(frq * 1.498, dur, vol)
 }


// Modul fuer Sprachausgabe
let voices = [] // Wird erst on Demand gefuellt
export async function joSagmal(txt2say, zlang = "en", stopflag = false) {
    if (window.speechSynthesis === undefined) {
        joPingError()
        await doDialogOK("ERROR Speech", "API not found")
        return // Synthi Nicht vorhanden
    }
    if (stopflag) window.speechSynthesis.cancel()
    const slang = zlang.toLowerCase().substring(0, 2)

    for (let w = 0; w < 100; w++) { // Laden der Sprachen etwas ungewohnt, max. 1 sec warten, kann bis zu 10 sec dauern...
        voices = window.speechSynthesis.getVoices()
        await dashSleepMs(10)
        if (voices.find(v => v.lang.indexOf(slang) >= 0)) break // This Language found
    }
    if (!voices.length) {
        joPingError()
        await doDialogOK("ERROR Speech", "No voices found")
        return // Sprache fehlt
    }
    //console.log(voices) // List all available voices

    const sprichDas = new SpeechSynthesisUtterance(txt2say)

    const myvoice = voices.find(v => v.lang.indexOf(slang) >= 0)
    if (myvoice !== undefined) {
        sprichDas.default = false
        sprichDas.voice = myvoice
        sprichDas.lang = slang
    }

    window.speechSynthesis.speak(sprichDas);
}

// ein einfacher dynamischer OK-Dialog, returned true wenn OK
let okDialog
const okDialogHtml = `<button class="jo-dialog-buttonclose">&#10006;</button>
        <progress class="jo-dialog-progress" ></progress>
        <div class="jo-dialog-header">(Header)</div>
        <div class="jo-dialog-content">(Content)</div>
        <div class="jo-dialog-footer">
            <span class="ok-dialog-check">
                <i class ="bi-question-octagon"></i>
                <input id="okSurecheck" type="checkbox">
                &nbsp;
                &nbsp;
                &nbsp;
            </span>
            <button class="jo-dialog-buttonok">(Ok)</button>
        </div>`

let okresult = false // muss global zugaenglich sein wg. evtl. events
let okdialogbusy = false
export async function doDialogOK(header, contenthtml, okbuttonhtml = null, confirmflag = false, timeout_sec = 0) {
    try {
        if (okdialogbusy) {
            for (; ;) {
                await dashSleepMs(100)
                if (!okdialogbusy) break
            }
        }
        joPing()

        okresult = false
        okdialogbusy = true

        if (okDialog == undefined) {
            okDialog = document.createElement("dialog")
            okDialog.id = "ok-dialog"
            okDialog.innerHTML = okDialogHtml
            document.body.appendChild(okDialog)
            okDialog.querySelector(".jo-dialog-buttonclose").addEventListener("click", () => {
                okdialogbusy = false
            })
            okDialog.querySelector(".jo-dialog-buttonok").addEventListener("click", () => {
                okresult = true
                okdialogbusy = false
            })
            okDialog.querySelector(".ok-dialog-check input").addEventListener('click', (e) => {
                okDialog.querySelector(".jo-dialog-buttonok").disabled = !okDialog.querySelector(".ok-dialog-check input").checked
            })
        }
        const cchall = okDialog.querySelector(".ok-dialog-check")
        const cchk = cchall.querySelector("input")
        const okb = okDialog.querySelector(".jo-dialog-buttonok")

        okDialog.querySelector(".jo-dialog-header").innerHTML = header
        okDialog.querySelector(".jo-dialog-content").innerHTML = contenthtml
        okb.innerHTML = okbuttonhtml ? okbuttonhtml : "&#10004; OK"

        if (confirmflag) {
            okb.disabled = true
            cchk.checked = false
            cchall.hidden = false
        } else {
            okb.disabled = false
            cchall.hidden = true
        }
        const prog = okDialog.querySelector(".jo-dialog-progress")
        prog.value = 0
        prog.max = timeout_sec
        prog.hidden = !(timeout_sec > 0)

        okDialog.showModal()
        for (; ;) {
            await dashSleepMs(100)
            if (timeout_sec > 0) {
                prog.value = prog.max - timeout_sec
                timeout_sec -= 0.1
                if (timeout_sec <= 0) break;
            }
            if (!okdialogbusy) break
        }
        okDialog.close()
        okdialogbusy = false
    } catch (err) {
        console.error(`ERROR(doDialogOK): ${err}`)
    }
    return okresult
}

// User-Spezischer Dialog, es gibt immer nur ein Level
let customDialog
const customDialogHtml = `<button class="jo-dialog-buttonclose">&#10006;</button>
        <div class="jo-dialog-header">(Header)</div>
        <div class="jo-dialog-content">(Content)</div>
        <div class="jo-dialog-footer">
        <button class="jo-dialog-buttonok">(Ok)</button>
        <span class="jo-dialog-buttons-customextra"></span>
        </div>`

let customdialogbusy = false
let customdialogresult
// Teil 1: Custom Dialog vorbereiten
export function prepareCustomDialog(header, contenthtml, okhtml = null, buttosextrahtml = null) {
    try {
        joPing()
        if (customdialogbusy) throw new Error("Custom Dialog busy")
        customdialogbusy = true

        if (customDialog == undefined) {
            customDialog = document.createElement("dialog")
            customDialog.id = "custom-dialog"
            customDialog.innerHTML = customDialogHtml
            document.body.appendChild(customDialog)
            customDialog.querySelector(".jo-dialog-buttonclose").addEventListener("click", () => {
                customdialogresult = "X"
                customdialogbusy = false
            })
            customDialog.querySelector(".jo-dialog-buttonok").addEventListener("click", () => {
                customdialogresult = "OK"
                customdialogbusy = false
            })
        }
        const okb = customDialog.querySelector(".jo-dialog-buttonok")

        customDialog.querySelector(".jo-dialog-header").innerHTML = header
        customDialog.querySelector(".jo-dialog-content").innerHTML = contenthtml
        okb.innerHTML = okhtml ? okhtml : "&#10004; OK"
        customDialog.querySelector(".jo-dialog-buttons-customextra").innerHTML = buttosextrahtml ? buttosextrahtml : ""
    } catch (err) {
        console.error(`ERROR(prepareCustomDialog): ${err}`)
    }
    return customDialog
}
// Teil 2: Dialog ausfuehren
export async function doCustomDialog(timeout_sec = 0) {
    try {
        customdialogresult = "?"
        customDialog.showModal()
        for (; ;) {
            await dashSleepMs(100)
            if (timeout_sec > 0) {
                timeout_sec -= 0.1
                if (timeout_sec <= 0) {
                    customdialogresult = "TIMEOUT"
                    break;
                }
            }
            if (!customdialogbusy) break
        }
        customDialog.close()
        customdialogbusy = false
    } catch (err) {
        console.error(`ERROR(doCustomDialog): ${err}`)
    }
    return customdialogresult
}
// Teil 3: optional Dialog extern schliessen
export function closeCustomDialog(txtreason) {
    try {
        if (!customdialogbusy) throw new Error("No Custom Dialog")
        customdialogresult = txtreason
        customdialogbusy = false // Rest macht 
    } catch (err) {
        console.error(`ERROR(closeCustomDialog): ${err}`)
    }
}

//  Globaler Spinner als Overlay 
let spinnerDialog
const spinnerHtml = `<div><i class="bi-gear jo-icon-ani-rotate"></i></div>
        <div><progress class="jo-spinner-progress"></progress></div>
        <h2 id="spinnerReason">(Spinner)</h2>
        <div id="spinnerInfo">(Info)</div><br>`

let spinnerBusy = 0
let spinnerReason // Zeigt allg. Grund an
let spinnerInfo // laufender Infotext, kann geandert werden
let spinnerProgress
let spinner_time_max
let spinner_time_cnt
let spinner_show_time

// Wake Lock: Keep screen ON - request fails usually system-related, such as low battery.
const requestWakeLock = async () => {
    try {
      /*const wakeLock =*/ await navigator.wakeLock.request("screen");
    } catch (err) {
        console.warn(`ERROR(requestWakeLock): ${err}`)
    }
}
// info0: null, "&nbsp;" oder "HTML" - Show Time oder Progress (%)
// Kann mehrfach DUMMY aufgerufen werden damit pro spinnerClose() 1 Instanz zugemacht wird
export function spinnerShow(reason, info0, max_sec = 0, show_time = false) {
    try {
        if (spinnerDialog == undefined) {
            spinnerDialog = document.createElement("dialog")
            spinnerDialog.id = "spinner-dialog"
            spinnerDialog.innerHTML = spinnerHtml
            document.body.appendChild(spinnerDialog)
            spinnerReason = document.getElementById("spinnerReason")
            spinnerInfo = document.getElementById("spinnerInfo")
            spinnerProgress = document.querySelector(".jo-spinner-progress")
        }
        spinner_show_time = show_time
        spinnerProgress.value = spinner_time_cnt = 0
        if (max_sec > 0) {
            spinner_time_max = max_sec
            if (show_time) spinnerProgress.max = max_sec
            else spinnerProgress.max = 100
        }
        if (reason) spinnerReason.innerHTML = reason
        if (info0) spinnerInfo.innerHTML = info0
        if (!spinnerBusy) {
            spinnerDialog.showModal()
            spinnerDialog.blur()
            if ("wakeLock" in navigator) requestWakeLock()
        }
        spinnerBusy++
    }
    catch (err) {
        console.error(`ERROR(spinnerShow): ${err}`)
    }
}
// Mit closeall == true immer schliesen, sonst inkrementell
export function spinnerClose(closeall = false) {
    if (spinnerBusy) {
        spinnerBusy--
        if (closeall) spinnerBusy = 0
        if (!spinnerBusy) spinnerDialog.close()
    }
    return spinnerBusy
}
export function spinnerSetReason(nrhtml) {
    spinnerReason.innerHTML = nrhtml
}
export function spinnerSetInfo(infohtml) {
    spinnerInfo.innerHTML = infohtml
}
// Spinnerbalken in Prozent
export function spinnerSetProgress(perc) {
    spinnerProgress.value = perc
}
// Schaltet Spinner in jedem Fall auf Time um und setzt neue Maximaltime
export function spinnerSetTime(nt) {
    spinner_show_time = true
    spinner_time_max = nt
    spinnerProgress.max = nt
    spinnerProgress.value = spinner_time_cnt = 0
}
export function spinnerGetBusy() {
    return spinnerBusy
}

// Interner Timer, wird alle 1 sec aufgerufen
let callback1sec // Wenn definiert: aufrufen
function dashInternalTimerSec() {
    if (spinnerBusy) {
        if (spinner_time_cnt++ >= spinner_time_max) {
            spinnerClose()
        } else if (spinner_show_time) spinnerProgress.value = spinner_time_cnt
    }
    if (callback1sec !== undefined) callback1sec()

}
// Setzt zusaetzöichen externen callback
export function dashSetTimer1sec(cb) {
    callback1sec = cb
}

// Limit Sidebar (if present) to factor (0.3-0.5) of viewport if expanded
export function sidebarMax(factor) {
    const sb = document.querySelector('.jo-sidebar')
    if (sb) {
        const scw = document.documentElement.clientWidth;
        const sbw = sb.clientWidth;
        if (sbw > scw * factor) {
            sidebarState = 5; // Next CLick: Shrink 
        }
        sidebarClick(false)   // initial Shrinked on small screens
    }
}

// Helper Function for Scrollspies etc...
// Tests if Element is fully insode of Viewport
export function isFullInViewportHeight(element) {
    const { top, bottom } = element.getBoundingClientRect()
    const { innerHeight } = window
    return top >= 0 && bottom <= innerHeight
}

//Helpers Function fuer FETCH

// Diese Funktion holt JSON Daten via GET von einer URL (CORS optional rudimentaer) und komplett LEISE
// JSON liefern Komponenten: {error: 'Fehlermeldung'} oder sonstiger JSON-Wert/[Array]
// Es wird entweder fctOK(data) oder fctError(error) aufgerufen.
// Wichtig: Wenn ein Spinner laeuft, pro fetch() spinnerShow() aufrufen und pro fctOK/Error spinnerClose
export function fetch_get_json(fetchUrl, fctOK, fctError = null) {
    fetch(fetchUrl, { method: 'GET', mode: 'cors' })
        .then(response => {
            if (!response?.ok) throw new Error(`${response.statusText} (${response.status})`)
            return response.text() // Umweg über .text(), falls kein JSON (z.B. 404)
        }).then(text => {
            try {
                const data = JSON.parse(text)
                if (data.error) throw new Error(data.error)
                fctOK(data)
            } catch (error) {
                throw new Error(`${error?.message}: ${text.length > 40 ? text.substring(0, 37) + '...' : text}`)
            }
        }).catch(error => {
            const emsg = `ERROR('${fetchUrl}'): '${error?.message}'`
            console.log(emsg)
            if (fctError) fctError(emsg)
        }) // z.B. bei nichtexistenter URL oder Non-JSON
}

// Minimalversion fuer Text 
export function fetch_get_txt(fetchUrl, fctOK, fctError = null) {
    fetch(fetchUrl, { method: 'GET', mode: 'cors' })
        .then(response => {
            if (!response?.ok) throw new Error(`${response.statusText} (${response.status})`)
            return response.text()
        }).then(text => {
            fctOK(text)
        }).catch(error => {
            const emsg = `ERROR('${fetchUrl}'): '${error?.message}'`
            console.log(emsg)
            if (fctError) fctError(emsg)
        }) // z.B. bei nichtexistenter URL
}

// Minimalversion fuer Blob
// Um Daraus ein Bild zu machen: myimg.src = objectURL = URL.createObjectURL(blob)
// und nachher URL.revokeObjectURL(objectURL) nicht vergessen fuer Freigabe
// accept ist Maske für MIME-Type, z.B. 'image/' oder 'application/pdf'
// Bsp:
// "https://joembedded.de/ltx/sw/php_qr/ltx_qr.php?text=Hallo" type: image/png, 
// "static/favicon.ico"; type: image/x-icon,
// "static/favicon.svg" type: image/svg+xml
// "crun/test.crun" type: application/octet-stream
// "index.html" type: text.html aus.
// Alle darstellbaren Bilformate: image/*
export function fetch_get_blob(fetchUrl, accept, fctOK, fctError = null) {
    fetch(fetchUrl, { method: 'GET', mode: 'cors' })
        .then(response => {
            if (!response?.ok) throw new Error(`${response.statusText} (${response.status})`)
            return response.blob()
        }).then(blob => {
            const btype = blob.type
            if(accept && !btype.startsWith(accept)) throw new Error(`Wrong MIME-Type: '${btype}'`)
            fctOK(blob)
        }).catch(error => {
            const emsg = `ERROR('${fetchUrl}'): '${error?.message}'`
            console.log(emsg)
            if (fctError) fctError(emsg)
        }) // z.B. bei nichtexistenter URL
}

// Dto mit POST und JSON-Daten. Achtung: werden alle parallel ausgefuehrt! Evtl. RaceConditions kapseln
export function fetch_post_json(fetchUrl, pdata, fctOK, fctError = null) {
    fetch(fetchUrl, {
        method: 'POST', mode: 'cors',
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(pdata)
    }).then(response => {
        if (!response?.ok) throw new Error(`${response.statusText} (${response.status})`)
        return response.text()
    }).then(text => {
        try {
            const data = JSON.parse(text)
            if (data.error) throw new Error(data.error)
            fctOK(data)
        } catch (error) {
            throw new Error(`${error?.message}: ${text.length > 40 ? text.substring(0, 37) + '...' : text}`)
        }
    }).catch(error => {
        const emsg = `ERROR('${fetchUrl}'): '${error?.message}'`
        console.log(emsg)
        if (fctError) fctError(emsg)
    }) // z.B. bei nichtexistenter URL oder Non-JSON
}

function dashInit() {
    const sb = document.querySelector(".jo-main-hamb")
    if (sb) {
        sidebarMax(0.33)
        sb.addEventListener("click", sidebarClick)
    }
    setInterval(dashInternalTimerSec, 1000)
}

//-------- PWA-Installation falls Button 'joInstallApp' vorhanden einschleussen ------------
const joInstallApp = document.querySelector("#joInstallApp")
if (joInstallApp) {
    window.addEventListener("DOMContentLoaded", async event => {
        if ('BeforeInstallPromptEvent' in window) {
            console.log("PWA[1] BeforeInstallPromptEvent supported but not fired yet");
        } else {
            console.log("PWA[2] BeforeInstallPromptEvent NOT supported");
        }
        joInstallApp.addEventListener("click", installApp);
    });

    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevents the default mini-infobar or install dialog from appearing on mobile
        e.preventDefault();
        // Save the event because you’ll need to trigger it later.
        deferredPrompt = e;
        // Show your customized install prompt for your PWA
        joInstallApp.style.display = "block";
        console.log("PWA[3] BeforeInstallPromptEvent fired");

    });

    window.addEventListener('appinstalled', (e) => {
        console.log("PWA[4] AppInstalled fired");
    });

    async function installApp() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            console.log("PWA[5] Installation Dialog opened");
            // Find out whether the user confirmed the installation or not
            const { outcome } = await deferredPrompt.userChoice;
            // The deferredPrompt can only be used once.
            deferredPrompt = null;
            // Act on the user's choice
            if (outcome === 'accepted') {
                console.log('PWA[6] User accepted the install prompt.', true);
            } else if (outcome === 'dismissed') {
                console.log('PWA[7] User dismissed the install prompt');
            }
            // We hide the install button
            joInstallApp.style.display = "none";
        }
    }
}

// -------- Allg. Setup------
window.addEventListener("load", dashInit)
console.log("jodash.js init, Version JS/CSS:", VERSION, '/', getComputedStyle(document.documentElement).getPropertyValue('--version').trim("\"\'"))
/***/
