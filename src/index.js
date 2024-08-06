#!/usr/bin/env node
const compression                 = require('compression')            // compression for express
const express                     = require('express')                // http framework
const { promises: fs, constants } = require("fs")                     // async io for server
const {existsSync, lstatSync}     = require("fs")                     // sync io stats
const {readFileSync}              = require("fs")                     // sync io
const path                        = require('path')                   // format file paths
const archiver                    = require('archiver')               // zip
const { program }                 = require('commander')              // parse args
const moment                      = require('moment')                 // format time
const homedir                     = require('os').homedir()           // home directory
const defualtKeyPath              = path.join(homedir,'.ssh/id_rsa')  // default ssh key
const Client                      = require("ssh2").Client            // ssh frowarding
const Socket                      = require("net").Socket             // ssh frowarding

//# Todo fix laggy UI

// Parse Flags and args
program
  .description('Serve files with a nice ui. single click to navigate, double click for a zip')
  // .argument('[file path]')
  .option('-p, --port <int>')
  .option('-f, --forward [domain]', 'domain of ssh forwading server')
  .option('-d, --domain <domain>', 'domain of desired url')
  .option('-k, --key <path>','private key path for forwarding agent')
  .option('-l, --lock <password>','password to enable access')

program.parse()
const options           = program.opts()
const folderToServe     = program.args           // # TODO
let port                = options.port          ?  Number(options.port) : 8000
let fwdServer           = options.forward!=true ?  options.forward : "rockz.one"
let requestedDomain     = options.domain        ?  options.domain : "localhost"
let key                 = ""
if (options.key){
  if (existsSync(options.key)){
    key = readFileSync(options.key).toString()
  }
}else if (existsSync(defualtKeyPath)){
  key = readFileSync(defualtKeyPath).toString()
}

// Make app and define what happens before the main logic of each route
const app = express()
app.disable('etag')
app.use(compression({ threshold: 0 }))
app.use((req, res, next) => {
  res.setHeader('Last-Modified', (new Date()).toUTCString())
  res.on('finish', async () => {
    if (!req.path.includes('@rockz/serve')){
      // Log request
      let day            = moment().format('DD/MMM/Y hh:mm:ssa')
      let method         = req.method + ` ${req.path}`
      let status         = res.statusCode 
      let fileSizeMessage= req?.fileSize ? `|file size: ${req.fileSize} bytes|` : ''
      let length         = res.getHeader('Content-Length') || res._contentLength 
      let lengthMessage  = length ? `|${length} bytes sent|` : ''
      console.log(`[${day}] ${method} ${status} ${fileSizeMessage} ${lengthMessage}`) 
    }
  })
  next()
})

// HTML wrapper for UI
const notFound = "<a href='/'><h>Path not found, click here to route back to root directory</h></a>"
let starthtml = `<!DOCTYPE html>
<html>
<head>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap" rel="stylesheet">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>File share</title>
</head>
<body>
<style>
* {
  box-sizing: border-box;
}
:root{
    --bg-color : whitesmoke;
    --font-color : #22728D;
}
// @media (prefers-color-scheme: dark) {
//   :root{
//     --bg-color : #1E1E1F;
//     --font-color : whitesmoke;
//    }
// }
@media (prefers-color-scheme: light) {
  :root{
    --bg-color : whitesmoke;
    --font-color : #22728D;
   }
}
html{
  margin: 0;
  padding: 10px;
  top:0;
  min-height: 130vh;
  width: 100vw;
  overflow-y: scroll;
  overflow-x: hidden;
}
html,body{
  background: var(--bg-color);
  font-family: "Roboto", sans-serif;
  font-weight: 300;
  font-style: normal;
  margin: 0;
  padding: 10px;
  top:0;
}
@media only screen and (max-width: 600px) {
  html,body {
    padding: 10px; 
  }
}
.grid{
	display: grid;
    align-items: center;
    jusify-items: center;
    align-content: center;
    justify-content: center;
    grid-template-columns: repeat(auto-fill, 180px);
    grid-gap: 30px;
    width: 100%;
    height: min-content;
    padding: 10px;
    overflow: hidden;
}
@media only screen and (max-width: 600px) {
  .grid{
    padding: 0px; 
    padding-top: 10px;
  }
}
.grid-item{
    display: grid;
    height: 150px;
    width: 120px;
    text-align: center;
    word-break: break-all;
}
a{
    color: var(--font-color);
    text-decoration: none;
}
a:hover{
    opacity: .8;
}
span{

}
</style>
<script>
var dblClicked=false;
function dlzip(url) {
  dblClicked=true
   setTimeout(()=>{dblClicked=false},150)
   window.location.href = url
}
function goto(url) {
  setTimeout(()=>{
    if(!dblClicked){
        window.open(url, "_self")
    }
  },50)
}
</script>
`
let endhtml = `

  async function render(){
    let grid = document.getElementById("contents")
    let html=""
    for (let index=0; index<directory.length; index++){
      const item = directory[index]
      if (item.isdir){
        html+=\`<a isdir="true" name="\${item.name}" onclick="goto('\${item.href}')" ondblclick="dlzip('\${item.href}.zip')" class="grid-item" title="Double click for zip">
                    <img height="115px" width="180px" src="/@rockz/serve/folder.webp"/>
                    <span>\${item.name}</span>
                </a>
              \`
      }else{
        html+=\`<a isdir="false" name="\${item.name}" onclick="goto('\${item.href}')" ondblclick="dlzip('\${item.href}.zip')" class="grid-item" title="Double click for zip">
                  <img style="padding-right:30px;padding-left:30px;" height="115px" width="180px" src="/@rockz/serve/file.webp"/>
                  <span>\${item.name}</span>
                </a>
              \`
      }
    }
    grid.innerHTML = html
  }

  function sortGrid(){
    const gridItems = document.getElementById("contents").children
    const gridList  = [].slice.call(gridItems)
   
    function sortFunction(gridItemA, gridItemB){
      const AisDir       = String(gridItemA.getAttribute('isdir')).toLowerCase() === "true"
      const nameA        = gridItemA.getAttribute('name')
      const BisDir       = String(gridItemB.getAttribute('isdir')).toLowerCase() === "true"
      const nameB        = gridItemB.getAttribute('name')
      if ((AisDir && BisDir) || !AisDir && !BisDir){
        console.log("aDir",AisDir, "bDir", BisDir, nameA.localeCompare(nameB, undefined, { numeric: true }))
        return nameA.localeCompare(nameB, undefined, { numeric: true })
      }else if(AisDir && !BisDir){
        return -1
      }else { // !AisDir && BisDir
        return 1
      }
    }
    gridList.sort(sortFunction)
    const gridContainer = document.getElementById("contents")
    gridContainer.innerHTML = ""
    gridList.forEach(grid => gridContainer.innerHTML += grid.outerHTML)
  }
   new Promise(res=>setTimeout(2000,res)).then(render().then(sortGrid()))
</script>
</body>
</html>
`

// Icons
app.get('/@rockz/serve/folder.webp',(req,res)=>{
  res.sendFile(__dirname+'/img/folder.webp')
})
app.get('/@rockz/serve/file.webp',(req,res)=>{
  res.sendFile(__dirname+'/img/file.webp')
})

// Any path with a zip
app.get('*.zip', async (req,res)=>{
  const parsedReqPath        = decodeURIComponent(req.path)
  const withoutZip           = parsedReqPath.replace(/.zip$/,"")
  const currentPathWithZip   = path.join(process.env.PWD, parsedReqPath)
  const currentPathNoZip     = path.join(process.env.PWD, withoutZip)
  const folderName           = currentPathNoZip.replace(process.env.PWD, '')
  const recursiveFlag        = true
  // if the zip exists send the zip
  const zipExists = await fs.access(currentPathWithZip, constants.F_OK).catch((err)=>{return true}) ? false : true
  if (zipExists){
    res.sendFile(currentPathWithZip, {dotfiles:'allow'})
  }
  // else make the zip on the fly and stream it
  else{
    const pathExists = await fs.access(currentPathNoZip, constants.F_OK).catch((err)=>{return true}) ? false : true
    if (pathExists){
      const pathStats = await fs.lstat(currentPathNoZip)
      if(pathStats.isDirectory()){
        const archive = archiver('zip')
        archive.on('error', function(err) { console.log(err);res.send('an error occured on the server') })
        archive.pipe(res)
        archive.directory(currentPathNoZip, folderName, recursiveFlag).finalize()
      }else{
        const archive = archiver('zip')
        archive.on('error', function(err) { console.log(err);res.send('an error occured on the server') })
        archive.pipe(res)
        archive.file(currentPathNoZip, { name: folderName }).finalize()
      }
    }else{
      res.status(404).send(notFound)
    }
  }
})

// Any non-zip path
app.get('*', async (req,res)=>{
    const parsedReqPath = decodeURIComponent(req.path)
    const currentPath   = path.join(process.env.PWD, parsedReqPath)

    const exists = await fs.access(currentPath, constants.F_OK).catch((err)=>{return true}) ? false : true
    if (exists){
        const pathStats = await fs.lstat(currentPath)
        if(pathStats.isDirectory()){
            const contents = await fs.readdir(currentPath) 
            // Breadcrumbs
            let   formattedContent  = `<span style="font-size:18px;"><a href="/">/</a><span> </span>`
            let   base              = ""
            let   pathParts         = parsedReqPath.split('/')
            for (let i=0; i<pathParts.length; i++)  {
                if (i!=0){
                        base+= '/'
                }
                base+= pathParts[i]
                formattedContent+=`<a href=${base}> ${pathParts[i]}</a>`
                if (i!=0){
                    formattedContent+='<span> /</span>'
                }
            }
            formattedContent+="</span>"

            // List files and directories
            formattedContent+='<div id="contents" class="grid"></div>'
            let directory = []
            for (i=0; i<contents.length; i++){
              const listing      = path.join(currentPath, contents[i])
              const subPathStats = await fs.lstat(listing)
              const isDir        = subPathStats.isDirectory()
              const link         = listing.replace(process.env.PWD, '')
              let   name         = link.split("/").pop()
              if (name.length>30){
                // 19 characters, three dots, 8 chars with ending
                name = name.slice(0,19) + '...' + name.slice(-8)
              }
              directory.push({isdir: isDir, href: link, name: name}) 
            }
            formattedContent+=`\n<script>\nlet directory=${JSON.stringify(directory, null, 4)}`
            res.send(starthtml + formattedContent + endhtml)
        }else{
            req.fileSize = pathStats.size
            res.sendFile(currentPath, {dotfiles:'allow'})
        }
    }else{
      res.status(404).send(notFound)
    }
})

// Any other get requests
app.get("*", (req,res)=>{
  res.status(404).send(notFound)
})

// Start the server
app.listen(port, ()=>{
  console.log(`Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...`)
})

async function forwardIfSet(){
  // Optionally port forward the server using a proxy
  if (options.forward){
    const sshClient = new Client()
    const config    = {
      server    : fwdServer,
      remoteHost: requestedDomain,
      remotePort: 80,            // TODO change to 80
      localHost : "localhost",
      localPort : port,
    }
    
    sshClient
      .on("ready", () => {
        // Log stuff from the server
        sshClient.shell((err, stream) => {
          if (err) throw err
          stream.on("data", data => {console.log(data.toString())})
        })
        // Request port forwarding from the remote server
        sshClient.forwardIn(config.remoteHost, config.remotePort, (err, forwardPort) => {
          if (err) throw err;
          sshClient.emit("forward-in", forwardPort)
        })
      })

      // On port forwarding request accepted, handle new connections, why 443 work but not 80 on fwd?
      .on("tcp connection", (info, accept, reject) => {
        let remote;
        const srcSocket = new Socket()
        srcSocket
          .on("error", err => {
            if (remote === undefined) reject()
            else remote.end()
          })
          .connect(config.localPort, config.localPort, () => {
            remote = accept()
            srcSocket.pipe(remote).pipe(srcSocket)
          })
      })
      
      // Use ssh key or password 
      if (key){
        sshClient.connect({
          type      : "publickey",
          host      : fwdServer,
          username  : "",      // only works for localhost.run if this is nokey
          privateKey: key
        })
      }else{
        sshClient.connect({
          type     : "password",
          host     : fwdServer,
          username : "nokey",
          password : ""
        })
      }

    sshClient.on("error", (err) => {
      console.log("Something in forwarding configuration is not quite right...")
      console.log(config)
      process.exit()
    })
    .on("close", (info) => {
      console.log("Forwarding session ended, exiting...")
      sshClient.end()
      process.exit()
    })
  }
}

forwardIfSet()
/* Timing Test
            let started=moment().unix()
            console.log("reading", started)
            // timing to measure
            let done = moment().unix()
            console.log("read", done, "total =",done-started, "seconds")
*/