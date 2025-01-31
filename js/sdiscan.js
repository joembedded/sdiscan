/* sdiscan.js 
* Info: Fontsize auch PICO nur via JD.dashSetFont() aenderrbarm --pico-font-size nicht mgl.
*/

import * as JD from './jodash.js'
import './FileSaver.js' // SaveAs

const _dbg = false // true - Set to true to get sample data

//--------- globals ------ 
export const VERSION = 'V0.1 / 31.01.2025'
export const COPYRIGHT = '(C)JoEmbedded.de'

document.getElementById("svers").textContent = VERSION

document.getElementById("clearoutput").addEventListener('click', () => {
    document.getElementById("scanoutput").value = ""
    document.getElementById("interpretation").innerHTML = ""
    document.getElementById("generatesdi").disabled = true
})

// Testdaten, wie erzeugt vom Converter
if(_dbg) {
    const dbgbut = document.getElementById("debugbutton")
    dbgbut.hidden = false
    dbgbut.addEventListener('click', () =>
    document.getElementById("scanoutput").value =
    "Reply: 'SDI:'0XL=11''\n" +
    "Reply: 'SDI:'0L:2''\n" +
    "Reply: 'SDI:'0#A55030,33,156''\n" +
    "Reply: 'SDI:'0#A53940,20,186''"
)}

var anzLoggers = 0
var firstSNO // Name of First SNO for exported File

document.getElementById("scanbuttonoutput").addEventListener('click', async (e) => {
    e.target.ariaBusy = true // Set Spinner
    const usertxt = document.getElementById("scanoutput").value
    const lines = usertxt.split(/\r?\n/)
    var loggers = [] // Array mit 3 Entries: ADR,BYTES,SIG
    var sdiadr = null  // Scanned SDI12-Adr
    anzLoggers = 0
    document.getElementById("interpretation").innerHTML = ""
    document.getElementById("generatesdi").disabled = true

    try {
        lines.forEach(element => {
            const lof = element.indexOf("SDI:'")
            if (lof >= 0) {
                const tsdiadr = element.charAt(lof + 5)
                if (sdiadr === null) sdiadr = tsdiadr
                else if (sdiadr != tsdiadr) throw new Error(`SDI12-Adress change: ('${sdiadr}')/('${tsdiadr}')?`)
                const rest = element.substring(lof + 6)
                if (rest.startsWith('#') && rest.endsWith("''") && rest.length >= 15) {
                    const sd = rest.substring(1, rest.length - 2).split(',')
                    if (sd.length != 3 || sd[0].length != 6 || parseInt(sd[1]) < 15 || parseInt(sd[1]) > 128) throw new Error(`Format: ('${element}')`)
                    loggers.push(sd)
                }
            }
        })
        //console.log("Found:", loggers)

        if (loggers.length) {
            document.getElementById("sdi12addr").value = sdiadr ? sdiadr : '?'
            const interpretation = document.getElementById("interpretation")
            for (let i = 0; i < loggers.length; i++) {
                const tlogger = loggers[i]
                const clone = document.getElementById("iptemplate").content.cloneNode(true) // DeepClone
                const sel = clone.querySelector(".ipindex")
                sel.textContent = i // Textindex
                const adr = clone.querySelector(".ipadr")
                adr.value = tlogger[0].toUpperCase()
                const anz = clone.querySelector(".ipnofchan")
                anz.value = Math.floor((tlogger[1] - 15) / 5)
                if(_dbg){
                    clone.querySelector(".ippin").value= '0000'
                }
                
                interpretation.appendChild(clone)
            }
            document.getElementById("generatesdi").disabled = false
            anzLoggers = loggers.length    
        } else { // aber keine Kommandos
            await JD.doDialogOK("ERROR (Scan)", "No Loggers?")
        }
    
    } catch (err) {
        loggers = []
        sdiadr = null
        anzLoggers = 0        
        await JD.doDialogOK("ERROR (Scan)", err)
    }
    e.target.ariaBusy = false
})

document.getElementById("addmanual").addEventListener('click', async (e) => {
    const clone = document.getElementById("iptemplate").content.cloneNode(true) // DeepClone
    clone.querySelector(".ipindex").textContent = anzLoggers++
    document.getElementById("interpretation").appendChild(clone)
    document.getElementById("generatesdi").disabled = false
})

function isHex(num) {
    return num.match(/[0-9a-f]/i) // i: Case insentitiv
}
  
document.getElementById("generatesdi").addEventListener('click', async (e) => {
    e.target.ariaBusy = true // Set Spinner
    document.getElementById("commands").value = ""
    document.getElementById("gencrun").disabled = true

    const fuserlist = document.getElementById("interpretation").querySelectorAll(".grid")

    try {
        const usdiadr = document.getElementById("sdi12addr").value
        if(usdiadr.length !== 1 || !usdiadr.match(/[\?0-9a-z]/i)) throw new Error("Sdi12-Addr: 1 Character")

        const uloggers=[]
        firstSNO = "sdiscan_invalid"
        let tchans = 0
        fuserlist.forEach((e,idx) => {
            const wadr = e.querySelector('.ipadr').value.toUpperCase()
            if(wadr.length !== 6 || !isHex(wadr)) throw new Error(`Device ${idx}: SNO: 6 Characters (Hex)`)
             const upin = e.querySelector('.ippin').value.toUpperCase()
            if(upin.length !== 4 || !isHex(upin)) throw new Error(`Device ${idx}: PIN: 4 Characters (Hex)`)
            const wchan = parseInt(e.querySelector('.ipnofchan').value)
            if(isNaN(wchan)) throw new Error(`Device ${idx}: No. of Channels: Digit`)
            const wsig = e.querySelector('.ipwsig').checked
            const wcnt = e.querySelector('.ipwcnt').checked
            var etot= wchan
            if(wsig) etot++
            if(wcnt) etot++
            tchans += etot
            // SDI12Adr, PIN, WirelessChans, FlagSig, FlagMCnt, TotalChans
            uloggers.push({adr: wadr, pin: upin, chan: wchan, sig:wsig, mcnt: wcnt, tot:etot})
        })
        //console.log("Total Chans:", tchans)
        if(!tchans) throw new Error("No Channels")
            firstSNO = "sdiscan_"+uloggers[0].adr
        const sdicmds=[]
        // Header of File
        sdicmds.push("// SDISCAN - CRUN Command File")
        sdicmds.push(".expect connected")
        sdicmds.push("z+")
        sdicmds.push(".sleep 1000")
        var lsum = 0
        uloggers.forEach(e =>{
            var firstchan = true
            for(let i=0;i<e.tot;i++){
                var lcmd = `z${usdiadr}XP${lsum}=`
                var rchan 
                if(i<e.chan) rchan = i
                else if(e.mcnt) rchan = 254
                else if(e.sig) rchan = 255
                if(!firstchan) lcmd+= `3,${rchan}!`
                else lcmd += `5,${rchan},${e.adr},${e.pin}!`
                firstchan=false
                sdicmds.push(lcmd)
                lsum++
            }
        })
        sdicmds.push('z-')
        document.getElementById("commands").value = sdicmds.join("\n")+"\n"
        document.getElementById("gencrun").disabled = false        
    } catch (err) {
        await JD.doDialogOK("ERROR (Generate SDI12)", err)
    }
    e.target.ariaBusy = false
})

// Daten als File exportieren, benoetigt FileSaver.js
async function fileExport(string, fname) {
    try{
        const atype = 'text/plain;charset=utf-8'
        const blob = new Blob([string], {  type: atype  }) // BlobType: MDN-File API
        saveAs(blob, fname)
    } catch (err) {
        await JD.doDialogOK("ERROR (Export)", err)
    }
  }

document.getElementById("gencrun").addEventListener('click', async (e) => {
    e.target.ariaBusy = true // Set Spinner
    const cmds=document.getElementById("commands").value
    console.log(cmds)
    fileExport(cmds,firstSNO+".crun")
    e.target.ariaBusy = false
})


JD.dashSetFont(0.75)
console.log("sdiscan.js init, Version:", VERSION)
