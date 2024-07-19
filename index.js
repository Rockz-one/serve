#!/usr/bin/env node
const compression                 = require('compression')
const express                     = require('express')
const { promises: fs, constants } = require("fs")
const {existsSync, lstatSync}     = require("fs")
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
const options  = program.opts()
const filepath = program.args // # TODO
let port       = options.port ?  Number(options.port) : 8000

const app = express()
app.use(compression())
app.use((req, res, next) => {
  res.on('finish', async () => {
    if (!req.path.includes('@rockz/serve')){
      // Log request
      let day    = moment().format('D/MMM/Y hh:mm:ssa')
      let method = req.method + ` ${req.path}`
      let status = res.statusCode 
      console.log(`[${day}] ${method} ${status}`)
    }
  })
  next()
})



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
    grid-template-columns: repeat(auto-fill, 180px);
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
    height: 150px;
    width: 120px;
    text-align: center;
    word-break: break-all;
}
a{
    color: #22728D;
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
   setTimeout(()=>{dblClicked=false},250)
   window.location.href = url
}
function goto(url) {
  setTimeout(()=>{
    if(!dblClicked){
        console.log('here')
        window.location.href = url
    }
  },100)
}
</script>
`
let endhtml = `
</div>
</div>
</body>
</html>
`

// Icons
app.get('/@rockz/serve/folder.png',(req,res)=>{
  res.sendFile(__dirname+'/img/folder.png')
})
app.get('/@rockz/serve/file.png',(req,res)=>{
  res.sendFile(__dirname+'/img/file.png')
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
            formattedContent+='<div class="grid">'
            for (i=0; i<contents.length; i++){
                const listing = path.join(currentPath, contents[i])
                const subPathStats = await fs.lstat(listing)
                const isDir = subPathStats.isDirectory()
                const link  = listing.replace(process.env.PWD, '')
                let   name  = link.split("/").pop()
                 if (name.length>30){
                    // 19 characters, three dots, 8 chars with ending
                    name = name.slice(0,19) + '...' + name.slice(-8)
                 }
                if (isDir){
                  formattedContent+=`<a onclick="goto('${link}')" ondblclick="dlzip('${link}.zip')" class="grid-item" title="Double click for zip">
                    <img height="115px" width="180px" src="/@rockz/serve/folder.png"/>
                    <span>${name}</span>
                    </a>
                    `
                }else{
                  formattedContent+=`<a onclick="goto('${link}')" ondblclick="dlzip('${link}.zip')" class="grid-item" title="Double click for zip">
                    <img style="padding-right:30px;padding-left:30px;" height="115px" width="180px" src="/@rockz/serve/file.png"/>
                    <span>${name}</span>
                    </a>
                    `
                }
            }

            res.send(starthtml + formattedContent + endhtml)

        }else{
            res.sendFile(currentPath, {dotfiles:'allow'})
        }
    }else{
      res.status(404).send(notFound)
    }
})

// Any other method of request like post, put or patch
app.all("*", (req,res)=>{
  res.status(404).send(notFound)
})

app.listen(port, ()=>{
    console.log(`Serving HTTP on 0.0.0.0 port ${port} (http://0.0.0.0:${port}/) ...`)
})