#!/usr/bin/env node
const compression                 = require('compression')
const express                     = require('express')
const { promises: fs, constants } = require("fs")
const path                        = require('path')
const archiver                    = require('archiver')
const { program }                 = require('commander')
const moment                      = require('moment')


// Parse Flags and args
program
  .description('Serve files with a nice ui. single click to navigate, double click for a zip')
  .argument('[file path]')
  .option('-p, --port <int>')
program.parse()
const options = program.opts()
const args    = program.args

const app = express()
app.use(compression())
let port  = 8000


const notFound = "<a href="/"><h>Path not found, click here to route back to root directory</h></a>"

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
}
@media (prefers-color-scheme: dark) {
  :root{
    --bg-color : whitesmoke;
   }
}
html,body{
    background: var(--bg-color);
    font-family: "Roboto", sans-serif;
    font-weight: 300;
    font-style: normal;
    margin: 0;
    padding: 10px;
    top:0;
    height: 100vh;
    width: 100vw;
    overflow-x: hidden;
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
    grid-template-columns: repeat(auto-fill, 115px);
    grid-gap: 30px;
    width: 100%;
    height: min-content;
    padding: 50px;
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
    height: 140px;
    width: 110px;
    text-align: center;
}
a{
    color: #22728D;
    text-decoration: none;
}
a:hover{
    opacity: .8;
}
</style>
<script>
var dblClicked=false;
function dlzip(url) {
  //console.log("here first")
  dblClicked=true
  //console.log(url)
  // const a = document.createElement('a')
  //a.href = url
  //a.download = url.split('/').pop()
  //document.body.appendChild(a)
  //a.click()
  //document.body.removeChild(a)
   setTimeout(()=>{dblClicked=false},1000)
   window.location.href = url
}
function goto(url) {
  setTimeout(()=>{
    if(!dblClicked){
        console.log('here')
        window.location.href = url
    }
  },500)
}
</script>
`
let endhtml = `
</div>
</div>
</body>
</html>
`




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
      res.sendStatus(404).send(notFound)
    }
  }

  // Log request
  let day    = moment().format('D/MMM/Y h:m:sa')
  let method = req.method + ` ${req.path}`
  let status = res.statusCode 
  console.log(`[${day}] ${method} ${status}`)
})

app.get('*', async (req,res)=>{
    const parsedReqPath = decodeURIComponent(req.path)
    const currentPath   = path.join(process.env.PWD, parsedReqPath)

    const exists = await fs.access(currentPath, constants.F_OK).catch((err)=>{return true}) ? false : true
    if (exists){
        const pathStats = await fs.lstat(currentPath)
        if(pathStats.isDirectory()){
            const contents = await fs.readdir(currentPath)
            // Breadcrumbs
            let   formattedContent  = `<a href="/">/</a><span> </span>`
            let   base              = ""
            let   pathParts         = parsedReqPath.split('/')
            for (let i=0; i<pathParts.length; i++)  {
                if (i!=0){
                        base+= '/'
                }
                base+= pathParts[i]
                formattedContent+=`<a href=${base}>${pathParts[i]}</a>`
                if (i!=0){
                    formattedContent+='<span> /</span>'
                }
            }

            // List files and directories
            formattedContent+='<div class="grid">'
            for (i=0; i<contents.length; i++){
                const listing = path.join(currentPath, contents[i])
                const subPathStats = await fs.lstat(listing)
                const isDir = subPathStats.isDirectory()
                const link  = listing.replace(process.env.PWD, '')
                const name  = link.split("/").pop()
                if (isDir){
                    formattedContent+=`<a onclick="goto('${link}')" ondblclick="dlzip('${link}.zip')" class="grid-item" title="Double click for zip">
    <svg height="115px" width="115px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 496 496" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path style="fill:#0560c2;" d="M484.8,48H287.2c-6.4,0-12,0-18.4,9.6L258.4,72H24.8C11.2,72,0,84.8,0,98.4v314.4 C0,426.4,11.2,440,24.8,440h446.4c13.6,0,24.8-13.6,24.8-27.2V169.6V99.2V57.6C496,52,491.2,48,484.8,48z"></path> <path style="fill:#221551;" d="M485.6,371.2c6.4-4.8,10.4-12,10.4-20V169.6V99.2V57.6c0-5.6-4.8-9.6-11.2-9.6H287.2 c-6.4,0-12,0-18.4,9.6L258.4,72H24.8C12,72,1.6,82.4,0,94.4L485.6,371.2z"></path> <path style="fill:#342f46;" d="M496,424c0,13.6-11.2,24-24.8,24H24.8C11.2,448,0,437.6,0,424l8-253.6C8,156.8,19.2,144,32.8,144H464 c13.6,0,24.8,12.8,24.8,26.4L496,424z"></path> <path style="fill:#331919;" d="M492.8,436L9.6,162.4C8.8,165.6,8,168.8,8,172L0,424c0,13.6,11.2,24,24.8,24h446.4 C480,448,488,443.2,492.8,436z"></path> </g></svg>
    ${name}</a>`
                }else{
                    formattedContent+=`<a onclick="goto('${link}')" ondblclick="dlzip('${link}.zip')" class="grid-item">
                    <svg style="padding-top:8px;" width="115px"  height="100px" version="1.0" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64" enable-background="new 0 0 64 64" xml:space="preserve" fill="#000000"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <g> <g> <polygon fill="#F9EBB2" points="46,3.414 46,14 56.586,14 "></polygon> <path fill="#F9EBB2" d="M45,16c-0.553,0-1-0.447-1-1V2H8C6.896,2,6,2.896,6,4v56c0,1.104,0.896,2,2,2h48c1.104,0,2-0.896,2-2V16 H45z"></path> </g> <path fill="#394240" d="M14,26c0,0.553,0.447,1,1,1h34c0.553,0,1-0.447,1-1s-0.447-1-1-1H15C14.447,25,14,25.447,14,26z"></path> <path fill="#394240" d="M49,37H15c-0.553,0-1,0.447-1,1s0.447,1,1,1h34c0.553,0,1-0.447,1-1S49.553,37,49,37z"></path> <path fill="#394240" d="M49,43H15c-0.553,0-1,0.447-1,1s0.447,1,1,1h34c0.553,0,1-0.447,1-1S49.553,43,49,43z"></path> <path fill="#394240" d="M49,49H15c-0.553,0-1,0.447-1,1s0.447,1,1,1h34c0.553,0,1-0.447,1-1S49.553,49,49,49z"></path> <path fill="#394240" d="M49,31H15c-0.553,0-1,0.447-1,1s0.447,1,1,1h34c0.553,0,1-0.447,1-1S49.553,31,49,31z"></path> <path fill="#394240" d="M15,20h16c0.553,0,1-0.447,1-1s-0.447-1-1-1H15c-0.553,0-1,0.447-1,1S14.447,20,15,20z"></path> <path fill="#394240" d="M59.706,14.292L45.708,0.294C45.527,0.112,45.277,0,45,0H8C5.789,0,4,1.789,4,4v56c0,2.211,1.789,4,4,4h48 c2.211,0,4-1.789,4-4V15C60,14.723,59.888,14.473,59.706,14.292z M46,3.414L56.586,14H46V3.414z M58,60c0,1.104-0.896,2-2,2H8 c-1.104,0-2-0.896-2-2V4c0-1.104,0.896-2,2-2h36v13c0,0.553,0.447,1,1,1h13V60z"></path> <polygon opacity="0.15" fill="#231F20" points="46,3.414 56.586,14 46,14 "></polygon> </g> </g></svg>
                    ${name}</a>`
                }
            }

            res.send(starthtml + formattedContent + endhtml)

        }else{
            res.sendFile(currentPath, {dotfiles:'allow'})
        }
    }else{
      res.sendStatus(404).send(notFound)
    }

    // Log request
    let day    = moment().format('D/MMM/Y h:m:sa')
    let method = req.method + ` ${req.path}`
    let status = res.statusCode 
    console.log(`[${day}] ${method} ${status}`)
})

app.all("*", (req,res)=>{
  res.sendStatus(404).send(notFound)

  // Log request
  let day    = moment().format('D/MMM/Y h:m:sa')
  let method = req.method + ` ${req.path}`
  let status = res.statusCode 
  console.log(`[${day}] ${method} ${status}`)
})

app.listen(port, ()=>{
    console.log(`Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...`)
})